import { Injectable } from '@nestjs/common';
import type { CreateTaskListRequest, TaskListResponse, UpdateTaskListRequest } from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromArg } from '../../../core/runtime/change-target.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import type { TaskList } from '../domain/task-list.js';
import { TaskListRepository } from '../domain/task-list.repository.js';
import { TaskListMapper } from './task-list.mapper.js';

const DEFAULT_LIST_NAME = 'Tasks';

const change = { ...workspaceFromArg, metadata: (list: TaskListResponse) => ({ name: list.name, spaceId: list.spaceId }) };

@Injectable()
export class ListsService {
  constructor(
    private readonly lists: TaskListRepository,
    private readonly spacesService: SpacesService,
  ) {}

  /** All lists in the workspace, so the sidebar tree loads in one call. */
  @Cached({ entities: ['list'], shared: true })
  async listForWorkspace(workspaceId: string): Promise<TaskListResponse[]> {
    const lists = await this.lists.listByWorkspace(workspaceId);
    return lists.map(TaskListMapper.toResponse);
  }

  @Audited('list.create', change)
  @Announces('list.created', workspaceFromArg)
  async create(_actor: Actor, workspaceId: string, spaceId: string, request: CreateTaskListRequest): Promise<TaskListResponse> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    return TaskListMapper.toResponse(await this.lists.create({ workspaceId, spaceId, name: request.name.trim() }));
  }

  @Audited('list.update', change)
  @Announces('list.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, listId: string, request: UpdateTaskListRequest): Promise<TaskListResponse> {
    const list = await this.getInWorkspace(workspaceId, listId);
    if (request.name !== undefined) list.name = request.name.trim();
    return TaskListMapper.toResponse(await this.lists.save(list));
  }

  @Audited('list.delete', change)
  @Announces('list.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, listId: string): Promise<TaskListResponse> {
    const list = await this.getInWorkspace(workspaceId, listId);
    await this.lists.delete(workspaceId, listId);
    return TaskListMapper.toResponse(list);
  }

  /**
   * Where a task created straight in a space goes: its first list, or a new
   * "Tasks" list when the space has none yet (created, audited and announced
   * like any other list).
   */
  async defaultFor(actor: Actor, workspaceId: string, spaceId: string): Promise<TaskList> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    const existing = await this.lists.firstInSpace(workspaceId, spaceId);
    if (existing) return existing;
    const created = await this.create(actor, workspaceId, spaceId, { name: DEFAULT_LIST_NAME });
    return this.getInWorkspace(workspaceId, created.id);
  }

  async getInWorkspace(workspaceId: string, listId: string): Promise<TaskList> {
    return found(await this.lists.findInWorkspace(workspaceId, listId), 'List');
  }
}
