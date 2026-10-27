import { Injectable } from '@nestjs/common';
import type { CreateFolderRequest, FolderResponse, MoveFolderRequest, UpdateFolderRequest } from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromArg } from '../../../core/runtime/change-target.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { FolderTreePolicy } from '../domain/folder-tree.policy.js';
import type { ListFolder } from '../domain/list-folder.js';
import { ListFolderRepository } from '../domain/list-folder.repository.js';
import { TaskListRepository } from '../domain/task-list.repository.js';
import { TaskListMapper } from './task-list.mapper.js';

const change = { ...workspaceFromArg, metadata: (folder: FolderResponse) => ({ name: folder.name, spaceId: folder.spaceId }) };

/** Folders that group a space's lists, nested up to FOLDER_MAX_DEPTH. */
@Injectable()
export class FoldersService {
  constructor(
    private readonly folders: ListFolderRepository,
    private readonly lists: TaskListRepository,
    private readonly spacesService: SpacesService,
  ) {}

  @Cached({ entities: ['folder'], shared: true })
  async listForWorkspace(workspaceId: string): Promise<FolderResponse[]> {
    return (await this.folders.listByWorkspace(workspaceId)).map(TaskListMapper.toFolderResponse);
  }

  @Audited('folder.create', change)
  @Announces('folder.created', workspaceFromArg)
  async create(_actor: Actor, workspaceId: string, spaceId: string, request: CreateFolderRequest): Promise<FolderResponse> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    const siblings = await this.folders.listBySpace(workspaceId, spaceId);
    FolderTreePolicy.assertRoomFor(siblings.length);
    const parent = request.parentId ? await this.getInWorkspace(workspaceId, request.parentId) : null;
    FolderTreePolicy.assertValidPlacement({ spaceId, parent, folders: siblings });
    const position = Math.max(0, ...siblings.filter((folder) => folder.parentId === (parent?.id ?? null)).map((folder) => folder.position)) + 1;
    const folder = await this.folders.create({
      workspaceId,
      spaceId,
      parentId: parent?.id ?? null,
      name: request.name.trim(),
      color: request.color ?? null,
      icon: request.icon ?? null,
      position,
    });
    return TaskListMapper.toFolderResponse(folder);
  }

  @Audited('folder.update', change)
  @Announces('folder.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, folderId: string, request: UpdateFolderRequest): Promise<FolderResponse> {
    const folder = await this.getInWorkspace(workspaceId, folderId);
    if (request.name !== undefined) folder.name = request.name.trim();
    if (request.color !== undefined) folder.color = request.color;
    if (request.icon !== undefined) folder.icon = request.icon;
    return TaskListMapper.toFolderResponse(await this.folders.save(folder));
  }

  @Audited('folder.move', change)
  @Announces('folder.updated', workspaceFromArg)
  async move(_actor: Actor, workspaceId: string, folderId: string, request: MoveFolderRequest): Promise<FolderResponse> {
    const folder = await this.getInWorkspace(workspaceId, folderId);
    const parent = request.parentId ? await this.getInWorkspace(workspaceId, request.parentId) : null;
    const folders = await this.folders.listBySpace(workspaceId, folder.spaceId);
    FolderTreePolicy.assertValidPlacement({ folderId, spaceId: folder.spaceId, parent, folders });
    folder.parentId = parent?.id ?? null;
    folder.position =
      request.position ?? Math.max(0, ...folders.filter((item) => item.parentId === folder.parentId && item.id !== folderId).map((item) => item.position)) + 1;
    return TaskListMapper.toFolderResponse(await this.folders.save(folder));
  }

  /** Removes the folder only: its lists and sub-folders move up to where the folder was. */
  @Audited('folder.delete', change)
  @Announces('folder.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, folderId: string): Promise<FolderResponse> {
    const folder = await this.getInWorkspace(workspaceId, folderId);
    await this.lists.moveAllFromFolder(workspaceId, folderId, folder.parentId);
    for (const child of (await this.folders.listBySpace(workspaceId, folder.spaceId)).filter((item) => item.parentId === folderId)) {
      child.parentId = folder.parentId;
      await this.folders.save(child);
    }
    await this.folders.delete(workspaceId, folderId);
    return TaskListMapper.toFolderResponse(folder);
  }

  async getInWorkspace(workspaceId: string, folderId: string): Promise<ListFolder> {
    return found(await this.folders.findInWorkspace(workspaceId, folderId), 'Folder');
  }
}
