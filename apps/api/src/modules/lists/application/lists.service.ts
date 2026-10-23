import { Injectable } from '@nestjs/common';
import type { CreateTaskListRequest, TaskListResponse, UpdateTaskListRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { changeOfAction, domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import type { TaskList } from '../domain/task-list.js';
import { TaskListRepository } from '../domain/task-list.repository.js';
import { TaskListMapper } from './task-list.mapper.js';

@Injectable()
export class ListsService {
  constructor(
    private readonly lists: TaskListRepository,
    private readonly spacesService: SpacesService,
    private readonly auditLogger: AuditLogger,
    private readonly eventBus: EventBus,
  ) {}

  /** All lists in the workspace, so the sidebar tree loads in one call. */
  async listForWorkspace(workspaceId: string): Promise<TaskListResponse[]> {
    const lists = await this.lists.listByWorkspace(workspaceId);
    return lists.map(TaskListMapper.toResponse);
  }

  async create(
    actor: Actor,
    workspaceId: string,
    spaceId: string,
    request: CreateTaskListRequest,
  ): Promise<TaskListResponse> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    const list = await this.lists.create({ workspaceId, spaceId, name: request.name.trim() });
    await this.audit(actor, 'list.create', list);
    return TaskListMapper.toResponse(list);
  }

  async update(actor: Actor, workspaceId: string, listId: string, request: UpdateTaskListRequest): Promise<TaskListResponse> {
    const list = await this.getInWorkspace(workspaceId, listId);
    if (request.name !== undefined) list.name = request.name.trim();
    const saved = await this.lists.save(list);
    await this.audit(actor, 'list.update', saved);
    return TaskListMapper.toResponse(saved);
  }

  async remove(actor: Actor, workspaceId: string, listId: string): Promise<void> {
    const list = await this.getInWorkspace(workspaceId, listId);
    await this.lists.delete(workspaceId, listId);
    await this.audit(actor, 'list.delete', list);
  }

  async getInWorkspace(workspaceId: string, listId: string): Promise<TaskList> {
    const list = await this.lists.findInWorkspace(workspaceId, listId);
    if (!list) throw DomainError.notFound('List');
    return list;
  }

  private async audit(actor: Actor, action: string, list: TaskList): Promise<void> {
    await this.auditLogger.record(actor, {
      action,
      targetType: 'list',
      targetId: list.id,
      workspaceId: list.workspaceId,
      metadata: { name: list.name, spaceId: list.spaceId },
    });
    // Live updates for everyone looking at this workspace.
    await this.eventBus.publish(domainEvent('list', changeOfAction(action), { workspaceId: list.workspaceId, entityId: list.id, actorId: actor.userId }));
  }
}
