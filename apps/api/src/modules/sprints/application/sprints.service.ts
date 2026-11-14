import { Injectable } from '@nestjs/common';
import type {
  CompleteSprintRequest,
  CreateSprintRequest,
  SprintReportResponse,
  SprintResponse,
  UpdateSprintRequest,
} from '@taskflow/shared-types';
import { SPRINT_COMPLETE_MAX_MOVES } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromArg } from '../../../core/runtime/change-target.js';
import { Clock } from '../../../core/time/clock.port.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import type { Sprint, SprintWithCounts } from '../domain/sprint.js';
import { SprintLifecyclePolicy } from '../domain/sprint-lifecycle.policy.js';
import { buildSprintReport } from '../domain/sprint-report.js';
import { SprintRolloverPolicy } from '../domain/sprint-rollover.policy.js';
import { SprintRepository } from '../domain/sprint.repository.js';
import { SprintMapper } from './sprint.mapper.js';

const change = { ...workspaceFromArg, metadata: (sprint: SprintResponse) => ({ name: sprint.name, spaceId: sprint.spaceId }) };

@Injectable()
export class SprintsService {
  constructor(
    private readonly sprints: SprintRepository,
    private readonly spacesService: SpacesService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
    private readonly clock: Clock,
  ) {}

  @Cached({ entities: ['sprint', 'task'], shared: true })
  async listInSpace(workspaceId: string, spaceId: string): Promise<SprintResponse[]> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    const sprints = await this.sprints.listInSpace(workspaceId, spaceId);
    return sprints.map(SprintMapper.toResponse);
  }

  async get(workspaceId: string, sprintId: string): Promise<SprintResponse> {
    return SprintMapper.toResponse(await this.getInWorkspace(workspaceId, sprintId));
  }

  @Audited('sprint.create', change)
  @Announces('sprint.created', workspaceFromArg)
  async create(_actor: Actor, workspaceId: string, spaceId: string, request: CreateSprintRequest): Promise<SprintResponse> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    SpaceGuard.assert(spaceId, 'sprint.manage');
    SprintLifecyclePolicy.assertValidRange(request.startDate, request.endDate);
    const created = await this.sprints.create({
      workspaceId,
      spaceId,
      name: request.name.trim(),
      goal: request.goal?.trim() ?? '',
      startDate: request.startDate,
      endDate: request.endDate,
    });
    return this.get(workspaceId, created.id);
  }

  @Audited('sprint.update', change)
  @Announces('sprint.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, sprintId: string, request: UpdateSprintRequest): Promise<SprintResponse> {
    const sprint = await this.getInWorkspace(workspaceId, sprintId);
    SpaceGuard.assert(sprint.spaceId, 'sprint.manage');
    SprintLifecyclePolicy.assertEditable(sprint);
    const startDate = request.startDate ?? sprint.startDate;
    const endDate = request.endDate ?? sprint.endDate;
    SprintLifecyclePolicy.assertValidRange(startDate, endDate);

    await this.sprints.save({
      ...toSprint(sprint),
      name: request.name?.trim() ?? sprint.name,
      goal: request.goal?.trim() ?? sprint.goal,
      startDate,
      endDate,
    });
    return this.get(workspaceId, sprintId);
  }

  @Audited('sprint.delete', change)
  @Announces('sprint.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, sprintId: string): Promise<SprintResponse> {
    const sprint = await this.getInWorkspace(workspaceId, sprintId);
    SpaceGuard.assert(sprint.spaceId, 'sprint.manage');
    SprintLifecyclePolicy.assertDeletable(sprint);
    // Tasks return to the backlog through ON DELETE SET NULL.
    await this.sprints.delete(workspaceId, sprintId);
    return SprintMapper.toResponse(sprint);
  }

  @Audited('sprint.start', change)
  @Announces('sprint.updated', workspaceFromArg)
  async start(_actor: Actor, workspaceId: string, sprintId: string): Promise<SprintResponse> {
    await this.unitOfWork.run(async () => {
      const sprint = await this.getInWorkspace(workspaceId, sprintId);
      SpaceGuard.assert(sprint.spaceId, 'sprint.manage');
      SprintLifecyclePolicy.assertCanStart(sprint, await this.sprints.hasActiveSprint(workspaceId, sprint.spaceId));
      await this.sprints.save({ ...toSprint(sprint), status: 'active', startedAt: this.clock.now() });
      // What the sprint commits to, for the report: what was added or removed later shows against it.
      await this.sprints.snapshot(workspaceId, sprint.id, 'start');
    });
    return this.get(workspaceId, sprintId);
  }

  /** Completes the sprint and moves unfinished tasks in the same transaction. */
  @Announces('sprint.updated', workspaceFromArg)
  async complete(actor: Actor, workspaceId: string, sprintId: string, request: CompleteSprintRequest): Promise<SprintResponse> {
    const moves = request.moves ?? [];
    if (moves.length > SPRINT_COMPLETE_MAX_MOVES) throw DomainError.invalid(`At most ${SPRINT_COMPLETE_MAX_MOVES} task moves`);
    if (new Set(moves.map((move) => move.taskId)).size !== moves.length) throw DomainError.invalid('Each task can only have one destination');
    await this.unitOfWork.run(async () => {
      const sprint = await this.getInWorkspace(workspaceId, sprintId);
      SpaceGuard.assert(sprint.spaceId, 'sprint.manage');
      SprintLifecyclePolicy.assertCanComplete(sprint);
      const target = request.moveOpenTasksToSprintId
        ? await this.getInWorkspace(workspaceId, request.moveOpenTasksToSprintId)
        : null;
      SprintRolloverPolicy.assertValidTarget(sprint, target);
      // The report's end state, taken before unfinished work leaves; where it went is noted after.
      await this.sprints.snapshot(workspaceId, sprint.id, 'end');

      // Per-task destinations first (each checked like the default target), then everything else.
      const byTarget = new Map<string | null, string[]>();
      for (const move of moves) byTarget.set(move.sprintId, [...(byTarget.get(move.sprintId) ?? []), move.taskId]);
      const destinations: Record<string, number> = {};
      const add = (key: string, count: number) => {
        destinations[key] = (destinations[key] ?? 0) + count;
      };
      for (const [targetId, taskIds] of byTarget) {
        const destination = targetId ? await this.getInWorkspace(workspaceId, targetId) : null;
        SprintRolloverPolicy.assertValidTarget(sprint, destination);
        add(destination?.id ?? 'backlog', await this.sprints.moveTasks(workspaceId, sprint.id, taskIds, destination?.id ?? null));
      }
      add(target?.id ?? 'backlog', await this.sprints.moveOpenTasks(workspaceId, sprint.id, target?.id ?? null));
      const moved = Object.values(destinations).reduce((sum, count) => sum + count, 0);
      await this.sprints.noteDestinations(workspaceId, sprint.id);

      // Remember what the sprint held before unfinished work left, for velocity (committed vs done).
      await this.sprints.save({ ...toSprint(sprint), status: 'completed', completedAt: this.clock.now(), committedTasks: sprint.totalTasks, committedPoints: sprint.totalPoints });
      // Audited here rather than with @Audited because the entry records where the tasks went.
      await this.auditLogger.record(actor, {
        action: 'sprint.complete',
        targetType: 'sprint',
        targetId: sprint.id,
        workspaceId,
        metadata: { name: sprint.name, spaceId: sprint.spaceId, movedTasks: moved, movedTo: target?.id ?? 'backlog', destinations },
      });
    });
    return this.get(workspaceId, sprintId);
  }

  /**
   * Committed vs delivered: live while the sprint is active, fixed once it's
   * completed. Needs task.view in the sprint's space (snapshots have task titles).
   */
  async report(workspaceId: string, sprintId: string): Promise<SprintReportResponse> {
    const sprint = await this.getInWorkspace(workspaceId, sprintId);
    SpaceGuard.assert(sprint.spaceId, 'task.view');
    if (sprint.status === 'planned') throw DomainError.invalid('The report starts when the sprint starts');
    const start = sprint.startedAt ? await this.sprints.snapshotRows(workspaceId, sprint.id, 'start') : null;
    const endSnapshot = sprint.status === 'completed' ? await this.sprints.snapshotRows(workspaceId, sprint.id, 'end') : [];
    // Sprints completed before snapshots were kept still hold their done work.
    const end = endSnapshot.length ? endSnapshot : await this.sprints.currentRows(workspaceId, sprint.id);
    const names = new Map((await this.sprints.listInSpace(workspaceId, sprint.spaceId)).map((item) => [item.id, item.name]));
    return buildSprintReport(sprint, start, end, (id) => names.get(id) ?? null);
  }

  /** Used by the tasks module before planning a task into a sprint. */
  async getPlannable(workspaceId: string, sprintId: string): Promise<Sprint> {
    const sprint = await this.getInWorkspace(workspaceId, sprintId);
    SprintLifecyclePolicy.assertCanReceiveTasks(sprint);
    return sprint;
  }

  async getInWorkspace(workspaceId: string, sprintId: string): Promise<SprintWithCounts> {
    return found(await this.sprints.findInWorkspace(workspaceId, sprintId), 'Sprint');
  }
}

/** Drops the read-only counts before saving. */
function toSprint({ totalTasks: _total, doneTasks: _done, ...sprint }: SprintWithCounts): Sprint {
  return sprint;
}
