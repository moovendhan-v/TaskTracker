export interface SpaceResponse {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CreateSpaceRequest {
  name: string;
  color?: string;
}

export type UpdateSpaceRequest = Partial<CreateSpaceRequest>;
