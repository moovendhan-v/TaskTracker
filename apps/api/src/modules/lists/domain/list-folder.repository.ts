import type { ListFolder, NewListFolder } from './list-folder.js';

export abstract class ListFolderRepository {
  abstract listByWorkspace(workspaceId: string): Promise<ListFolder[]>;
  abstract listBySpace(workspaceId: string, spaceId: string): Promise<ListFolder[]>;
  abstract findInWorkspace(workspaceId: string, folderId: string): Promise<ListFolder | null>;
  abstract create(folder: NewListFolder): Promise<ListFolder>;
  abstract save(folder: ListFolder): Promise<ListFolder>;
  abstract delete(workspaceId: string, folderId: string): Promise<void>;
}
