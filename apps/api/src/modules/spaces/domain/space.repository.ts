import type { NewSpace, Space } from './space.js';

export abstract class SpaceRepository {
  abstract listByWorkspace(workspaceId: string): Promise<Space[]>;
  abstract findInWorkspace(workspaceId: string, spaceId: string): Promise<Space | null>;
  abstract create(space: NewSpace): Promise<Space>;
  abstract save(space: Space): Promise<Space>;
  abstract delete(workspaceId: string, spaceId: string): Promise<void>;
}
