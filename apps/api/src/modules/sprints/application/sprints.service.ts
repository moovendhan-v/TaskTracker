import { Injectable } from '@nestjs/common';
import type {
  CompleteSprintRequest,
  CreateSprintRequest,
  SprintResponse,
  UpdateSprintRequest,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { changeOfAction, domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../core/time/clock.port.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import type { Sprint, SprintWithCounts } from '../domain/sprint.js';
import { SprintLifecyclePolicy } from '../domain/sprint-lifecycle.policy.js';
import { SprintRolloverPolicy } from '../domain/sprint-rollover.policy.js';
import { SprintRepository } from '../domain/sprint.repository.js';
import { SprintMapper } from './sprint.mapper.js';

@Injectable()
export class SprintsService {
  constructor(
    private readonly sprints: SprintRepository,
    private readonly spacesService: SpacesService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
  ) {}

  async listInSpace(workspaceId: string, spaceId: string): Promise<SprintResponse[]> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    const sprints = await this.sprints.listInSpace(workspaceId, spaceId);
    return sprints.map(SprintMapper.toResponse);
  }

  async get(workspaceId: string, sprintId: string): Promise<SprintResponse> {
    return SprintMapper.toResponse(await this.getInWorkspace(workspaceId, sprintId));
  }

  async create(actor: Actor, workspaceId: string, spaceId: string, request: CreateSprintRequest): Promise<SprintResponse> {
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
    await this.audit(actor, 'sprint.create', created);
    return this.get(workspaceId, created.id);
  }

  async update(actor: Actor, workspaceId: string, sprintId: string, request: UpdateSprintRequest): Promise<SprintResponse> {
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
    await this.audit(actor, 'sprint.update', sprint, { fields: Object.keys(request) });
    return this.get(workspaceId, sprintId);
  }

  async remove(actor: Actor, workspaceId: string, sprintId: string): Promise<void> {
    const sprint = await this.getInWorkspace(workspaceId, sprintId);
    SprintLifecyclePolicy.assertDeletable(sprint);
    // Tasks return to the backlog through ON DELETE SET NULL.
    await this.sprints.delete(workspaceId, sprintId);
    await this.audit(actor, 'sprint.delete', sprint);
  }

  async start(actor: Actor, workspaceId: string, sprintId: string): Promise<SprintResponse> {
    await this.unitOfWork.run(async () => {
      const sprint = await this.getInWorkspace(workspaceId, sprintId);
      SprintLifecyclePolicy.assertCanStart(sprint, await this.sprints.hasActiveSprint(workspaceId, sprint.spaceId));
      await this.sprints.save({ ...toSprint(sprint), status: 'active' });
      await this.audit(actor, 'sprint.start', sprint);
    });
    return this.get(workspaceId, sprintId);
  }

  /** Completes the sprint and moves unfinished tasks in the same transaction. */
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
      await this.audit(actor, 'sprint.complete', sprint, { movedTasks: moved, movedTo: target?.id ?? 'backlog' });
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
    const sprint = await this.sprints.findInWorkspace(workspaceId, sprintId);
    if (!sprint) throw DomainError.notFound('Sprint');
    return sprint;
  }

  private async audit(actor: Actor, action: string, sprint: Sprint, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLogger.record(actor, {
      action,
      targetType: 'sprint',
      targetId: sprint.id,
      workspaceId: sprint.workspaceId,
      metadata: { name: sprint.name, spaceId: sprint.spaceId, ...metadata },
    });
    // Live updates for everyone looking at this workspace.
    await this.eventBus.publish(domainEvent('sprint', changeOfAction(action), { workspaceId: sprint.workspaceId, entityId: sprint.id, actorId: actor.userId }));
  }
}

/** Drops the read-only counts before saving. */
function toSprint({ totalTasks: _total, doneTasks: _done, ...sprint }: SprintWithCounts): Sprint {
  return sprint;
}
