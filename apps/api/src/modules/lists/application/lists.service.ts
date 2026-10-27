import { Injectable } from '@nestjs/common';
import type { CreateTaskListRequest, MoveTaskListRequest, TaskListResponse, UpdateTaskListRequest } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromArg } from '../../../core/runtime/change-target.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { ListFolderRepository } from '../domain/list-folder.repository.js';
import type { TaskList } from '../domain/task-list.js';
import { TaskListRepository } from '../domain/task-list.repository.js';
import { TaskListMapper } from './task-list.mapper.js';

const DEFAULT_LIST_NAME = 'Tasks';

const change = { ...workspaceFromArg, metadata: (list: TaskListResponse) => ({ name: list.name, spaceId: list.spaceId }) };

@Injectable()
export class ListsService {
  constructor(
    private readonly lists: TaskListRepository,
    private readonly folders: ListFolderRepository,
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
    SpaceGuard.assert(spaceId, 'list.manage');
    const folderId = request.folderId ?? null;
    await this.assertFolderInSpace(workspaceId, spaceId, folderId);
    const position = (await this.lists.maxPosition(workspaceId, spaceId, folderId)) + 1;
    return TaskListMapper.toResponse(
      await this.lists.create({ workspaceId, spaceId, folderId, name: request.name.trim(), color: request.color ?? null, icon: request.icon ?? null, position }),
    );
  }

  @Audited('list.update', change)
  @Announces('list.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, listId: string, request: UpdateTaskListRequest): Promise<TaskListResponse> {
    const list = await this.getInWorkspace(workspaceId, listId);
    SpaceGuard.assert(list.spaceId, 'list.manage');
    if (request.name !== undefined) list.name = request.name.trim();
    if (request.color !== undefined) list.color = request.color;
    if (request.icon !== undefined) list.icon = request.icon;
    return TaskListMapper.toResponse(await this.lists.save(list));
  }

  /** Puts a list into a folder of its own space (or back under the space with null). */
  @Audited('list.move', change)
  @Announces('list.updated', workspaceFromArg)
  async move(_actor: Actor, workspaceId: string, listId: string, request: MoveTaskListRequest): Promise<TaskListResponse> {
    const list = await this.getInWorkspace(workspaceId, listId);
    SpaceGuard.assert(list.spaceId, 'list.manage');
    await this.assertFolderInSpace(workspaceId, list.spaceId, request.folderId);
    list.folderId = request.folderId;
    list.position = request.position ?? (await this.lists.maxPosition(workspaceId, list.spaceId, request.folderId)) + 1;
    return TaskListMapper.toResponse(await this.lists.save(list));
  }

  @Audited('list.delete', change)
  @Announces('list.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, listId: string): Promise<TaskListResponse> {
    const list = await this.getInWorkspace(workspaceId, listId);
    SpaceGuard.assert(list.spaceId, 'list.manage');
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

  private async assertFolderInSpace(workspaceId: string, spaceId: string, folderId: string | null): Promise<void> {
    if (!folderId) return;
    const folder = found(await this.folders.findInWorkspace(workspaceId, folderId), 'Folder');
    if (folder.spaceId !== spaceId) throw DomainError.invalid('A list can only go into a folder of its own project');
  }
}
