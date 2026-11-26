import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  API_TOKEN_CHALLENGE_MINUTES,
  API_TOKEN_DAYS,
  API_TOKEN_PREFIX,
  API_TOKEN_SCOPES,
  EXTENSION_SCOPES,
  type ApiTokenClient,
  type ApiTokenResponse,
  type ApiTokenScope,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ApiTokenRepository, type ApiTokenOwner, type ApiTokenRecord } from '../domain/api-token.repository.js';

/** PKCE S256 code challenge (RFC 7636): base64url of a SHA-256, 43 characters. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
/** PKCE code verifier: 43 to 128 unreserved characters. */
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
/** Our tokens: the prefix and 43 base64url characters (32 random bytes). */
const TOKEN = new RegExp(`^${API_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);
const MAX_ACTIVE = 20;

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');
const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

export interface IssuedToken {
  token: string;
  record: ApiTokenRecord;
}

/**
 * Personal API tokens. Connecting the extension: TaskFlow approves a PKCE challenge for the
 * signed-in person, and only the holder of the matching verifier can then pick up the token,
 * once. Only hashes are stored. A token acts as its owner (their current role, never a platform
 * role), narrowed by its scopes. Approving, issuing and revoking are audited.
 */
@Injectable()
export class ApiTokensService {
  constructor(
    private readonly tokens: ApiTokenRepository,
    private readonly transactional: TransactionalManager,
    private readonly audit: AuditLogger,
  ) {}

  async approve(actor: Actor, access: WorkspaceAccess, input: { challenge: string; name: string; client?: ApiTokenClient; scopes?: readonly string[] | null }): Promise<ApiTokenResponse> {
    if (!CHALLENGE.test(input.challenge)) throw DomainError.invalid('This connection link is not valid. Start again from the extension.');
    const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Browser extension';
    const scopes = this.scopes(input.scopes ?? EXTENSION_SCOPES);
    if ((await this.tokens.countActive(access.workspaceId, actor.userId)) >= MAX_ACTIVE) throw DomainError.conflict(`You have ${MAX_ACTIVE} connections in this workspace already. Disconnect one first.`);
    const now = Date.now();
    const record = await this.tokens.insertPending({
      workspaceId: access.workspaceId,
      userId: actor.userId,
      name,
      client: input.client ?? 'extension',
      scopes,
      challengeHash: sha256Hex(input.challenge),
      challengeExpiresAt: new Date(now + API_TOKEN_CHALLENGE_MINUTES * 60_000),
      expiresAt: new Date(now + API_TOKEN_DAYS * 86_400_000),
    });
    await this.audit.record(actor, { action: 'api_token.approve', targetType: 'api_token', targetId: record.id, workspaceId: access.workspaceId, metadata: { name, client: record.client, scopes } });
    return toResponse(record);
  }

  async list(actor: Actor, access: WorkspaceAccess): Promise<ApiTokenResponse[]> {
    return (await this.tokens.listOwn(access.workspaceId, actor.userId)).map(toResponse);
  }

  async revoke(actor: Actor, access: WorkspaceAccess, id: string): Promise<boolean> {
    const revoked = await this.tokens.revoke(access.workspaceId, actor.userId, id);
    if (!revoked) throw DomainError.notFound('Connection');
    await this.audit.record(actor, { action: 'api_token.revoke', targetType: 'api_token', targetId: id, workspaceId: access.workspaceId });
    return true;
  }

  /** The extension swaps its verifier for the token. Null while not (yet) approved; works once. */
  async exchange(verifier: string, ip: string | null): Promise<IssuedToken | null> {
    if (!VERIFIER.test(verifier)) throw DomainError.invalid('Invalid verifier');
    const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const record = await this.transactional.runInScope({ kind: 'platform' }, () => this.tokens.issue(sha256Hex(challengeOf(verifier)), sha256Hex(token), token.slice(0, API_TOKEN_PREFIX.length + 4)));
    if (!record) return null;
    await this.transactional.runInScope({ kind: 'workspace', workspaceId: record.workspaceId, userId: record.userId }, () =>
      this.audit.record({ userId: record.userId, platformRole: 'USER', ip }, { action: 'api_token.issue', targetType: 'api_token', targetId: record.id, workspaceId: record.workspaceId, metadata: { client: record.client } }),
    );
    return { token, record };
  }

  /** The token's owner and scopes, or null for anything unknown, revoked or expired. */
  async authenticate(raw: string): Promise<ApiTokenOwner | null> {
    if (!TOKEN.test(raw)) return null;
    return this.transactional.runInScope({ kind: 'platform' }, async () => {
      const owner = await this.tokens.findByTokenHash(sha256Hex(raw));
      if (!owner || owner.revokedAt || owner.expiresAt.getTime() <= Date.now()) return null;
      await this.tokens.touch(owner.id);
      return owner;
    });
  }

  /** "Disconnect" from the extension: the token revokes itself. */
  async revokeSelf(owner: ApiTokenOwner, ip: string | null): Promise<void> {
    await this.transactional.runInScope({ kind: 'workspace', workspaceId: owner.workspaceId, userId: owner.userId }, async () => {
      await this.tokens.revokeById(owner.id);
      await this.audit.record({ userId: owner.userId, platformRole: 'USER', ip }, { action: 'api_token.revoke', targetType: 'api_token', targetId: owner.id, workspaceId: owner.workspaceId, metadata: { by: 'client' } });
    });
  }

  private scopes(requested: readonly string[]): ApiTokenScope[] {
    const unique = [...new Set(requested)];
    if (!unique.length || unique.some((scope) => !(API_TOKEN_SCOPES as readonly string[]).includes(scope))) throw DomainError.invalid('Unknown scope');
    return unique as ApiTokenScope[];
  }
}

export function toResponse(record: ApiTokenRecord): ApiTokenResponse {
  return {
    id: record.id,
    name: record.name,
    client: record.client,
    scopes: record.scopes,
    prefix: record.prefix,
    pending: record.pending,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
  };
}
