import type { ApiTokenClient, ApiTokenScope } from '@taskflow/shared-types';

export interface ApiTokenRecord {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  client: ApiTokenClient;
  scopes: ApiTokenScope[];
  prefix: string | null;
  pending: boolean;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/** An issued token found by its hash, with its owner's name for the extension. */
export interface ApiTokenOwner extends ApiTokenRecord {
  userName: string;
  userEmail: string;
}

export interface NewPendingToken {
  workspaceId: string;
  userId: string;
  name: string;
  client: ApiTokenClient;
  scopes: readonly ApiTokenScope[];
  challengeHash: string;
  challengeExpiresAt: Date;
  expiresAt: Date;
}

export abstract class ApiTokenRepository {
  /** Own rows (workspace scope). */
  abstract insertPending(token: NewPendingToken): Promise<ApiTokenRecord>;
  abstract listOwn(workspaceId: string, userId: string): Promise<ApiTokenRecord[]>;
  abstract countActive(workspaceId: string, userId: string): Promise<number>;
  abstract revoke(workspaceId: string, userId: string, id: string): Promise<boolean>;
  /** Before anyone is known (platform scope, token service only). */
  abstract issue(challengeHash: string, tokenHash: string, prefix: string): Promise<ApiTokenRecord | null>;
  abstract findByTokenHash(tokenHash: string): Promise<ApiTokenOwner | null>;
  abstract touch(id: string): Promise<void>;
  abstract revokeById(id: string): Promise<void>;
  /** The workspace's name, for the extension (workspace scope). */
  abstract workspaceName(workspaceId: string): Promise<string | null>;
}
