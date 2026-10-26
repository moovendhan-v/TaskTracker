import { Injectable } from '@nestjs/common';
import {
  minutesBetween,
  TIME_LIMITS,
  type LogTimeRequest,
  type TaskTimeSummary,
  type TimeEntryQuery,
  type TimeEntryResponse,
  type UpdateTimeEntryRequest,
} from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import type { TimeEntry, TimeEntryView } from '../domain/time-entry.js';
import { TimeEntryPolicy } from '../domain/time-entry.policy.js';
import { TimeEntryRepository } from '../domain/time-entry.repository.js';

const change = { ...workspaceFromAccess, targetType: 'time_entry', metadata: (entry: TimeEntryResponse) => ({ userId: entry.userId, taskId: entry.taskId, minutes: entry.minutes }) };

/**
 * Timers, logged time, timesheets and time reports. Everyone with time.log
 * tracks their own time; time.view_all shows everyone's, time.manage lets a
 * person correct anyone's entries.
 */
@Injectable()
export class TimeTrackingService {
  constructor(
    private readonly entries: TimeEntryRepository,
    private readonly tasks: TasksService,
    private readonly spaces: SpacesService,
  ) {}

  @Cached({ entities: ['time_entry'] })
  async running(workspaceId: string, userId: string): Promise<TimeEntryResponse | null> {
    const entry = await this.entries.running(workspaceId, userId);
    return entry ? this.respond(entry) : null;
  }

  /** Starts a timer, stopping any timer the person already has running. */
  @Announces('time_entry.created', workspaceFromAccess)
  async start(actor: Actor, access: WorkspaceAccess, request: { taskId?: string | null; spaceId?: string | null; note?: string }): Promise<TimeEntryResponse> {
    await this.stopRunning(access.workspaceId, actor.userId);
    const target = await this.resolveTarget(access.workspaceId, request);
    const entry = await this.entries.create({
      workspaceId: access.workspaceId,
      userId: actor.userId,
      ...target,
      startedAt: new Date(),
      endedAt: null,
      minutes: 0,
      note: request.note?.trim() ?? '',
      activity: '',
    });
    return this.respond(entry);
  }

  @Announces('time_entry.updated', workspaceFromAccess)
  async stop(actor: Actor, access: WorkspaceAccess): Promise<TimeEntryResponse> {
    const stopped = await this.stopRunning(access.workspaceId, actor.userId);
    if (!stopped) throw DomainError.invalid('No timer is running');
    return this.respond(stopped);
  }

  @Announces('time_entry.created', workspaceFromAccess)
  async log(actor: Actor, access: WorkspaceAccess, request: LogTimeRequest): Promise<TimeEntryResponse> {
    return this.respond(await this.createFinished(actor, access, request));
  }

  /** The daily log: several entries saved together, all or none. */
  @Announces('time_entry.created', { ...workspaceFromAccess, entity: (entries: TimeEntryResponse[]) => entries[0] ?? { id: '' } })
  async logMany(actor: Actor, access: WorkspaceAccess, requests: readonly LogTimeRequest[]): Promise<TimeEntryResponse[]> {
    if (requests.length === 0) throw DomainError.invalid('Add at least one entry');
    if (requests.length > TIME_LIMITS.batchMax) throw DomainError.invalid(`Log at most ${TIME_LIMITS.batchMax} entries at once`);
    const total = requests.reduce((sum, request) => sum + TimeEntryPolicy.minutesFor(new Date(request.startedAt), new Date(request.endedAt)), 0);
    if (total > TIME_LIMITS.entryMinutesMax) throw DomainError.invalid('A daily log can cover at most 24 hours');
    const created: TimeEntry[] = [];
    for (const request of requests) created.push(await this.createFinished(actor, access, request));
    return Promise.all(created.map((entry) => this.respond(entry)));
  }

  @Audited('time_entry.update', change)
  @Announces('time_entry.updated', workspaceFromAccess)
  async update(actor: Actor, access: WorkspaceAccess, entryId: string, request: UpdateTimeEntryRequest): Promise<TimeEntryResponse> {
    const entry = await this.editable(actor, access, entryId);
    if (request.taskId !== undefined || request.spaceId !== undefined) {
      Object.assign(entry, await this.resolveTarget(access.workspaceId, { taskId: request.taskId ?? entry.taskId, spaceId: request.spaceId ?? entry.spaceId }));
    }
    if (request.startedAt !== undefined) entry.startedAt = new Date(request.startedAt);
    if (request.endedAt !== undefined) entry.endedAt = new Date(request.endedAt);
    if (entry.endedAt) entry.minutes = TimeEntryPolicy.minutesFor(entry.startedAt, entry.endedAt);
    if (request.note !== undefined) entry.note = request.note.trim();
    if (request.activity !== undefined) entry.activity = request.activity.trim();
    return this.respond(await this.entries.save(entry));
  }

  @Audited('time_entry.delete', change)
  @Announces('time_entry.deleted', workspaceFromAccess)
  async remove(actor: Actor, access: WorkspaceAccess, entryId: string): Promise<TimeEntryResponse> {
    const entry = await this.editable(actor, access, entryId);
    const response = await this.respond(entry);
    await this.entries.delete(access.workspaceId, entryId);
    return response;
  }

  /** Entries in a window. Without time.view_all a person only ever sees their own. */
  async list(access: WorkspaceAccess, userId: string, query: TimeEntryQuery): Promise<TimeEntryResponse[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    TimeEntryPolicy.checkRange(from, to);
    const canSeeAll = access.permissions.has('time.view_all');
    const userIds = canSeeAll ? query.userIds : [userId];
    if (!canSeeAll && query.userIds?.some((id) => id !== userId)) throw DomainError.forbidden("Seeing other people's time needs time.view_all");
    const rows = await this.cachedList(access.workspaceId, { from: query.from, to: query.to, userIds: userIds ? [...userIds].sort() : null, spaceId: query.spaceId ?? null, taskId: query.taskId ?? null });
    return rows;
  }

  @Cached({ entities: ['time_entry', 'task', 'space'], shared: true })
  async cachedList(workspaceId: string, filter: { from: string; to: string; userIds: string[] | null; spaceId: string | null; taskId: string | null }): Promise<TimeEntryResponse[]> {
    const rows = await this.entries.list(workspaceId, {
      from: new Date(filter.from),
      to: new Date(filter.to),
      ...(filter.userIds && { userIds: filter.userIds }),
      ...(filter.spaceId && { spaceId: filter.spaceId }),
      ...(filter.taskId && { taskId: filter.taskId }),
      limit: TIME_LIMITS.listMax,
    });
    return rows.map(toResponse);
  }

  async taskSummary(workspaceId: string, userId: string, taskId: string): Promise<TaskTimeSummary> {
    await this.tasks.get(workspaceId, taskId);
    const totals = await this.entries.totalsForTask(workspaceId, taskId, userId);
    return { taskId, totalMinutes: totals.total, myMinutes: totals.mine, entryCount: totals.count };
  }

  private async createFinished(actor: Actor, access: WorkspaceAccess, request: LogTimeRequest): Promise<TimeEntry> {
    const startedAt = new Date(request.startedAt);
    const endedAt = new Date(request.endedAt);
    const minutes = TimeEntryPolicy.minutesFor(startedAt, endedAt);
    const target = await this.resolveTarget(access.workspaceId, request);
    return this.entries.create({
      workspaceId: access.workspaceId,
      userId: actor.userId,
      ...target,
      startedAt,
      endedAt,
      minutes,
      note: request.note?.trim() ?? '',
      activity: request.activity?.trim() ?? '',
    });
  }

  private async stopRunning(workspaceId: string, userId: string): Promise<TimeEntry | null> {
    const running = await this.entries.running(workspaceId, userId);
    if (!running) return null;
    const endedAt = new Date();
    // Timers left running for days are capped at a day; anything shorter than a minute counts as one.
    const minutes = Math.min(Math.max(minutesBetween(running.startedAt, endedAt), 1), TIME_LIMITS.entryMinutesMax);
    running.endedAt = new Date(running.startedAt.getTime() + minutes * 60_000);
    running.minutes = minutes;
    return this.entries.save(running);
  }

  /** A task decides the space; without one the space must exist in the workspace. */
  private async resolveTarget(workspaceId: string, request: { taskId?: string | null; spaceId?: string | null }): Promise<{ taskId: string | null; spaceId: string | null }> {
    if (request.taskId) return { taskId: request.taskId, spaceId: (await this.tasks.get(workspaceId, request.taskId)).spaceId };
    if (request.spaceId) return { taskId: null, spaceId: (await this.spaces.getInWorkspace(workspaceId, request.spaceId)).id };
    return { taskId: null, spaceId: null };
  }

  private async editable(actor: Actor, access: WorkspaceAccess, entryId: string): Promise<TimeEntry> {
    const entry = found(await this.entries.findInWorkspace(access.workspaceId, entryId), 'Time entry');
    if (entry.userId === actor.userId) return entry;
    // Others' entries exist for people who may see them; the rest get the same answer as for a missing one.
    if (!access.permissions.has('time.view_all') && !access.permissions.has('time.manage')) throw DomainError.notFound('Time entry');
    if (!access.permissions.has('time.manage')) throw DomainError.forbidden("Changing other people's time needs time.manage");
    return entry;
  }

  private async respond(entry: TimeEntry): Promise<TimeEntryResponse> {
    return toResponse(found(await this.entries.findView(entry.workspaceId, entry.id), 'Time entry'));
  }
}

function toResponse(view: TimeEntryView): TimeEntryResponse {
  return {
    id: view.id,
    userId: view.userId,
    userName: view.userName,
    taskId: view.taskId,
    task: view.taskId && view.taskNumber !== null ? { id: view.taskId, number: view.taskNumber, title: view.taskTitle ?? '' } : null,
    spaceId: view.spaceId,
    spaceName: view.spaceName,
    startedAt: view.startedAt.toISOString(),
    endedAt: view.endedAt ? view.endedAt.toISOString() : null,
    // A running timer shows the time so far.
    minutes: view.endedAt ? view.minutes : Math.max(0, minutesBetween(view.startedAt, new Date())),
    note: view.note,
    activity: view.activity,
  };
}
