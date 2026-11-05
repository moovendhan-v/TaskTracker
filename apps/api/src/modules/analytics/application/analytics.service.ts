import { Injectable } from '@nestjs/common';
import { TIME_LIMITS, type DashboardRequest, type DashboardResponse } from '@taskflow/shared-types';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { AnalyticsRepository, type DashboardScope } from '../domain/analytics.repository.js';

const LIST_LIMIT = 20;
const TOP_TASKS = 15;

interface ResolvedScope {
  spaceId: string | null;
  assigneeIds: string[] | null;
  timeUserIds: string[] | null;
  priorities: string[] | null;
  categories: string[] | null;
  from: string;
  to: string;
  timeZone: string;
}

/**
 * Home and project dashboards: task counts are live, hours cover the chosen
 * window. Hours are everyone's only with time.view_all; otherwise they are the
 * caller's own, whatever people the request names.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analytics: AnalyticsRepository,
    private readonly spaces: SpacesService,
  ) {}

  async dashboard(access: WorkspaceAccess, userId: string, request: DashboardRequest): Promise<DashboardResponse> {
    checkWindow(request.from, request.to);
    if (!isTimeZone(request.timeZone)) throw DomainError.invalid('Unknown time zone');
    if (request.spaceId) await this.spaces.getInWorkspace(access.workspaceId, request.spaceId);
    // "Mine" comes from the session, never from ids in the request.
    const people = request.mine ? [userId] : request.userIds?.length ? [...new Set(request.userIds)].sort() : null;
    const hoursOnlyMine = !access.permissions.has('time.view_all');
    const scope: ResolvedScope = {
      spaceId: request.spaceId ?? null,
      assigneeIds: people,
      timeUserIds: hoursOnlyMine ? [userId] : people,
      priorities: request.priorities?.length ? [...new Set(request.priorities)].sort() : null,
      categories: request.categories?.length ? [...new Set(request.categories)].sort() : null,
      from: new Date(request.from).toISOString(),
      to: new Date(request.to).toISOString(),
      timeZone: request.timeZone,
    };
    return { hoursOnlyMine, ...(await this.compute(access.workspaceId, scope)) };
  }

  /** Same scope, same answer for anyone, so the result is shared between callers. */
  @Cached({ entities: ['task', 'status', 'space', 'list', 'member', 'time_entry'], shared: true, ttlSeconds: 120 })
  async compute(workspaceId: string, resolved: ResolvedScope): Promise<Omit<DashboardResponse, 'hoursOnlyMine'>> {
    const scope: DashboardScope = { workspaceId, ...resolved, from: new Date(resolved.from), to: new Date(resolved.to) };
    const [summary, time, byStatus, byPriority, overdueAging, dueForecast, createdVsClosed] = await Promise.all([
      this.analytics.taskSummary(scope),
      this.analytics.timeTotals(scope),
      this.analytics.byStatus(scope),
      this.analytics.byPriority(scope),
      this.analytics.overdueAging(scope),
      this.analytics.dueForecast(scope),
      this.analytics.createdVsClosed(scope),
    ]);
    const [minutesPerDay, minutesByPerson, minutesByProject, minutesByTask, people, projects, phases] = await Promise.all([
      this.analytics.minutesPerDay(scope),
      this.analytics.minutesByPerson(scope),
      this.analytics.minutesByProject(scope),
      this.analytics.minutesByTask(scope, TOP_TASKS),
      this.analytics.people(scope),
      this.analytics.projects(scope),
      this.analytics.phases(scope, LIST_LIMIT),
    ]);
    const [overdueTasks, dueSoonTasks, recentlyUpdated] = await Promise.all([
      this.analytics.taskList(scope, 'overdue', LIST_LIMIT),
      this.analytics.taskList(scope, 'dueSoon', LIST_LIMIT),
      this.analytics.taskList(scope, 'recent', LIST_LIMIT),
    ]);
    return {
      summary: { ...summary, minutesLogged: time.minutes, entries: time.entries, minutesAllTime: time.allTime },
      byStatus,
      byPriority,
      overdueAging,
      dueForecast,
      createdVsClosed,
      minutesPerDay,
      minutesByPerson,
      minutesByProject,
      minutesByTask,
      people,
      projects,
      phases,
      overdueTasks,
      dueSoonTasks,
      recentlyUpdated,
    };
  }
}

function checkWindow(from: string, to: string): void {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw DomainError.invalid('The range must end after it starts');
  if ((end.getTime() - start.getTime()) / 86_400_000 > TIME_LIMITS.rangeDaysMax) throw DomainError.invalid(`A range can cover at most ${TIME_LIMITS.rangeDaysMax} days`);
}

/** Only real IANA zones reach the database (as bound parameters in any case). */
export function isTimeZone(value: string): boolean {
  if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
