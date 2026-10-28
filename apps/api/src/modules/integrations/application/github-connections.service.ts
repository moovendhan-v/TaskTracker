import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DEFAULT_GITHUB_SYNC,
  DEFAULT_TASK_PREFIX,
  REPO_PATTERN,
  TASK_PREFIX_PATTERN,
  type GithubConnectionResponse,
  type GithubSecretResponse,
  type PullRequestLinkResponse,
  type SaveGithubConnectionRequest,
} from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { SecretBox } from '../../../core/crypto/secret-box.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import type { GithubConnection } from '../domain/github.js';
import { GithubRepository } from '../domain/github.repository.js';
import { GithubMapper } from './github.mapper.js';

const CONNECTIONS_MAX = 20;
const REPO = new RegExp(REPO_PATTERN);
const PREFIX = new RegExp(TASK_PREFIX_PATTERN);

const change = { ...workspaceFromAccess, targetType: 'integration', metadata: (connection: GithubConnectionResponse) => ({ repo: connection.repo }) };
const secretChange = { ...change, entity: (result: GithubSecretResponse) => result.connection, metadata: (result: GithubSecretResponse) => ({ repo: result.connection.repo }) };

/** GitHub repositories connected to a workspace. Webhook secrets are shown once and stored sealed. */
@Injectable()
export class GithubConnectionsService {
  constructor(
    private readonly github: GithubRepository,
    private readonly secretBox: SecretBox,
    private readonly tasksService: TasksService,
  ) {}

  async list(workspaceId: string): Promise<GithubConnectionResponse[]> {
    return (await this.github.list(workspaceId)).map(GithubMapper.toResponse);
  }

  async linksForTask(workspaceId: string, taskId: string): Promise<PullRequestLinkResponse[]> {
    await this.tasksService.get(workspaceId, taskId);
    return (await this.github.listLinksForTask(workspaceId, taskId)).map(GithubMapper.toLinkResponse);
  }

  @Audited('integration.github.connect', secretChange)
  @Announces('integration.created', { ...workspaceFromAccess, entity: (result: GithubSecretResponse) => result.connection })
  async create(actor: Actor, access: WorkspaceAccess, request: SaveGithubConnectionRequest): Promise<GithubSecretResponse> {
    const repo = request.repo.trim();
    if (!REPO.test(repo)) throw DomainError.invalid('Use the repository as owner/name, like acme/web');
    const existing = await this.github.list(access.workspaceId);
    if (existing.length >= CONNECTIONS_MAX) throw DomainError.invalid(`A workspace can connect at most ${CONNECTIONS_MAX} repositories`);
    if (existing.some((connection) => connection.repo.toLowerCase() === repo.toLowerCase())) throw DomainError.conflict('That repository is already connected');
    const secret = newSecret();
    const connection = await this.github.create({
      workspaceId: access.workspaceId,
      repo,
      taskPrefix: prefixOf(request.taskPrefix),
      sync: { ...DEFAULT_GITHUB_SYNC, ...request.sync },
      secretSealed: this.secretBox.seal(secret),
      createdById: actor.userId,
    });
    return { connection: GithubMapper.toResponse(connection), webhookSecret: secret };
  }

  /** Saving takes the connection over: linked tasks are then moved as you. */
  @Audited('integration.github.update', change)
  @Announces('integration.updated', workspaceFromAccess)
  async update(actor: Actor, access: WorkspaceAccess, connectionId: string, request: Omit<SaveGithubConnectionRequest, 'repo'>): Promise<GithubConnectionResponse> {
    const connection = await this.get(access.workspaceId, connectionId);
    const saved = await this.github.save({
      ...connection,
      taskPrefix: request.taskPrefix === undefined ? connection.taskPrefix : prefixOf(request.taskPrefix),
      sync: { ...DEFAULT_GITHUB_SYNC, ...connection.sync, ...request.sync },
      createdById: actor.userId,
    });
    return GithubMapper.toResponse(saved);
  }

  /** Whoever holds the secret can drive the connection, so rotating takes it over like saving does. */
  @Audited('integration.github.rotate_secret', secretChange)
  async rotateSecret(actor: Actor, access: WorkspaceAccess, connectionId: string): Promise<GithubSecretResponse> {
    const connection = await this.get(access.workspaceId, connectionId);
    const secret = newSecret();
    const saved = await this.github.save({ ...connection, secretSealed: this.secretBox.seal(secret), createdById: actor.userId });
    return { connection: GithubMapper.toResponse(saved), webhookSecret: secret };
  }

  @Audited('integration.github.disconnect', change)
  @Announces('integration.deleted', workspaceFromAccess)
  async remove(_actor: Actor, access: WorkspaceAccess, connectionId: string): Promise<GithubConnectionResponse> {
    const connection = await this.get(access.workspaceId, connectionId);
    await this.github.delete(access.workspaceId, connectionId);
    return GithubMapper.toResponse(connection);
  }

  private async get(workspaceId: string, connectionId: string): Promise<GithubConnection> {
    return found(await this.github.findInWorkspace(workspaceId, connectionId), 'Connection');
  }
}

function newSecret(): string {
  return randomBytes(32).toString('hex');
}

function prefixOf(value: string | undefined): string {
  const prefix = (value ?? DEFAULT_TASK_PREFIX).trim().toUpperCase();
  if (!PREFIX.test(prefix)) throw DomainError.invalid('The task prefix is letters and digits, starting with a letter, like TF');
  return prefix;
}
