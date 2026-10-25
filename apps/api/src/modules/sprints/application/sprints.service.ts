import { Injectable } from '@nestjs/common';
import type {
  CompleteSprintRequest,
  CreateSprintRequest,
  SprintResponse,
  UpdateSprintRequest,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromArg } from '../../../core/runtime/change-target.js';
import { Clock } from '../../../core/time/clock.port.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import type { Sprint, SprintWithCounts } from '../domain/sprint.js';
import { SprintLifecyclePolicy } from '../domain/sprint-lifecycle.policy.js';
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
      SprintLifecyclePolicy.assertCanStart(sprint, await this.sprints.hasActiveSprint(workspaceId, sprint.spaceId));
      await this.sprints.save({ ...toSprint(sprint), status: 'active' });
    });
    return this.get(workspaceId, sprintId);
  }

  /** Completes the sprint and moves unfinished tasks in the same transaction. */
  @Announces('sprint.updated', workspaceFromArg)
  async complete(actor: Actor, workspaceId: string, sprintId: string, request: CompleteSprintRequest): Promise<SprintResponse> {
    await this.unitOfWork.run(async () => {
      const sprint = await this.getInWorkspace(workspaceId, sprintId);
      SprintLifecyclePolicy.assertCanComplete(sprint);
      const target = request.moveOpenTasksToSprintId
        ? await this.getInWorkspace(workspaceId, request.moveOpenTasksToSprintId)
        : null;
      SprintRolloverPolicy.assertValidTarget(sprint, target);

      const moved = await this.sprints.moveOpenTasks(workspaceId, sprint.id, target?.id ?? null);
      await this.sprints.save({ ...toSprint(sprint), status: 'completed', completedAt: this.clock.now() });
      // Audited here rather than with @Audited because the entry records how many tasks moved.
      await this.auditLogger.record(actor, {
        action: 'sprint.complete',
        targetType: 'sprint',
        targetId: sprint.id,
        workspaceId,
        metadata: { name: sprint.name, spaceId: sprint.spaceId, movedTasks: moved, movedTo: target?.id ?? 'backlog' },
      });
    });
    return this.get(workspaceId, sprintId);
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
