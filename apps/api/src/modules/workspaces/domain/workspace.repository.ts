import type { NewWorkspace, Workspace } from './workspace.js';

export abstract class WorkspaceRepository {
  abstract findById(id: string): Promise<Workspace | null>;
  abstract findByIds(ids: readonly string[]): Promise<Workspace[]>;
  abstract create(workspace: NewWorkspace): Promise<Workspace>;
  abstract save(workspace: Workspace): Promise<Workspace>;
  abstract delete(id: string): Promise<void>;
}
