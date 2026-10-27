import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DEFAULT_STATUSES, type SaveTaskStatusRequest, type TaskStatusResponse } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { EnumOptionsRegistry } from '../../../core/query/enum-options.registry.js';
import { workspaceFromArg } from '../../../core/runtime/change-target.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { StatusPolicy } from '../domain/status.policy.js';
import type { TaskStatus } from '../domain/task-status.js';
import { TaskStatusRepository } from '../domain/task-status.repository.js';
import { StatusMapper } from './status.mapper.js';

const change = { ...workspaceFromArg, targetType: 'status', metadata: (status: TaskStatusResponse) => ({ name: status.name, category: status.category, spaceId: status.spaceId }) };

/** Each space's own statuses. Tasks reference them; their category decides what "closed" means. */
@Injectable()
export class StatusesService implements OnModuleInit {
  constructor(
    private readonly statuses: TaskStatusRepository,
    private readonly spacesService: SpacesService,
    private readonly eventBus: EventBus,
    private readonly enumOptions: EnumOptionsRegistry,
  ) {}

  onModuleInit(): void {
    // A new space starts with the default statuses, in the same transaction.
    this.eventBus.subscribe(async (event) => {
      if (event.type === 'space.created') await this.seedDefaults(event.workspaceId, event.entityId);
    });
    // The tasks table shows each status with its own name and colour.
    this.enumOptions.register('tasks', 'statusId', async (workspaceId) =>
      (await this.listForWorkspace(workspaceId)).map((status) => ({ value: status.id, label: status.name, color: status.color })),
    );
  }

  @Cached({ entities: ['status'], shared: true })
  async listForSpace(workspaceId: string, spaceId: string): Promise<TaskStatusResponse[]> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    return (await this.statuses.listForSpace(workspaceId, spaceId)).map(StatusMapper.toResponse);
  }

  @Cached({ entities: ['status'], shared: true })
  async listForWorkspace(workspaceId: string): Promise<TaskStatusResponse[]> {
    return (await this.statuses.listForWorkspace(workspaceId)).map(StatusMapper.toResponse);
  }

  /** Statuses by id, for building task responses. */
  async byId(workspaceId: string): Promise<Map<string, TaskStatusResponse>> {
    return new Map((await this.listForWorkspace(workspaceId)).map((status) => [status.id, status]));
  }

  /** Where new tasks in a space start: the first not-started status, or the first status. */
  async defaultFor(workspaceId: string, spaceId: string): Promise<TaskStatus> {
    const statuses = await this.statuses.listForSpace(workspaceId, spaceId);
    return found(statuses.find((status) => status.category === 'unstarted') ?? statuses[0], 'Status');
  }

  async getInWorkspace(workspaceId: string, statusId: string): Promise<TaskStatus> {
    return found(await this.statuses.findInWorkspace(workspaceId, statusId), 'Status');
  }

  @Audited('status.create', change)
  @Announces('status.created', workspaceFromArg)
  async create(_actor: Actor, workspaceId: string, spaceId: string, request: SaveTaskStatusRequest): Promise<TaskStatusResponse> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    SpaceGuard.assert(spaceId, 'space.manage');
    const existing = await this.statuses.listForSpace(workspaceId, spaceId);
    StatusPolicy.assertRoomFor(existing);
    const position = Math.max(0, ...existing.map((status) => status.position)) + 1;
    const [created] = await this.statuses.createMany([{ workspaceId, spaceId, name: request.name.trim(), color: request.color, category: request.category, position }]);
    return StatusMapper.toResponse(found(created, 'Status'));
  }

  @Audited('status.update', change)
  @Announces('status.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, statusId: string, request: Partial<SaveTaskStatusRequest>): Promise<TaskStatusResponse> {
    const status = await this.getInWorkspace(workspaceId, statusId);
    SpaceGuard.assert(status.spaceId, 'space.manage');
    if (request.name !== undefined) status.name = request.name.trim();
    if (request.color !== undefined) status.color = request.color;
    if (request.category !== undefined) status.category = request.category;
    return StatusMapper.toResponse(await this.statuses.save(status));
  }

  /** Deletes a status after moving its tasks to another status of the same space. */
  @Audited('status.delete', change)
  @Announces('status.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, statusId: string, moveToStatusId: string): Promise<TaskStatusResponse> {
    const status = await this.getInWorkspace(workspaceId, statusId);
    SpaceGuard.assert(status.spaceId, 'space.manage');
    const siblings = await this.statuses.listForSpace(workspaceId, status.spaceId);
    StatusPolicy.assertCanDelete(status, siblings, siblings.find((sibling) => sibling.id === moveToStatusId) ?? null);
    await this.statuses.moveTasks(workspaceId, statusId, moveToStatusId);
    await this.statuses.delete(workspaceId, statusId);
    return StatusMapper.toResponse(status);
  }

  @Announces('status.updated', { ...workspaceFromArg, entity: (statuses: TaskStatusResponse[]) => ({ id: statuses[0]?.spaceId ?? '' }) })
  async reorder(_actor: Actor, workspaceId: string, spaceId: string, orderedIds: string[]): Promise<TaskStatusResponse[]> {
    SpaceGuard.assert(spaceId, 'space.manage');
    const current = await this.statuses.listForSpace(workspaceId, spaceId);
    StatusPolicy.assertSameSet(current, orderedIds);
    await this.statuses.setPositions(workspaceId, orderedIds);
    return (await this.statuses.listForSpace(workspaceId, spaceId)).map(StatusMapper.toResponse);
  }

  /**
   * Gives a brand-new space its own set of statuses instead of the defaults
   * (templates). Refuses once any task uses the current ones.
   */
  async replaceForNewSpace(workspaceId: string, spaceId: string, statuses: readonly Pick<SaveTaskStatusRequest, 'name' | 'color' | 'category'>[]): Promise<TaskStatusResponse[]> {
    const current = await this.statuses.listForSpace(workspaceId, spaceId);
    for (const status of current) {
      if ((await this.statuses.countTasks(workspaceId, status.id)) > 0) throw DomainError.conflict('This space already has tasks');
    }
    for (const status of current) await this.statuses.delete(workspaceId, status.id);
    const created = await this.statuses.createMany(statuses.map((status, index) => ({ workspaceId, spaceId, ...status, position: index + 1 })));
    return created.map(StatusMapper.toResponse);
  }

  private async seedDefaults(workspaceId: string, spaceId: string): Promise<void> {
    if ((await this.statuses.listForSpace(workspaceId, spaceId)).length > 0) return;
    await this.statuses.createMany(DEFAULT_STATUSES.map((status, index) => ({ workspaceId, spaceId, ...status, position: index + 1 })));
  }
}
