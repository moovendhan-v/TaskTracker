import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DEFAULT_GITHUB_SYNC,
  DEFAULT_TASK_PREFIX,
  REPO_PATTERN,
  TASK_PREFIX_PATTERN,
  canInSpace,
  type GithubConnectionResponse,
  type GithubInboxPullRequestResponse,
  type GithubSecretResponse,
  type GithubSyncConflictResponse,
  type GithubSyncEventResponse,
  type TaskResponse,
  type PullRequestLinkResponse,
  type SaveGithubConnectionRequest,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
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

export const CONNECTIONS_MAX = 20;
const SYNC_LOG_SHOWN = 100;
const INBOX_SHOWN = 100;
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
    private readonly auditLogger: AuditLogger,
  ) {}

  /** What the connection's latest deliveries did, newest first. */
  async syncLog(workspaceId: string, connectionId: string): Promise<GithubSyncEventResponse[]> {
    await this.get(workspaceId, connectionId);
    return this.github.listEvents(workspaceId, connectionId, SYNC_LOG_SHOWN);
  }

  /** Pull requests that mention no task, across the workspace's connections. */
  inbox(workspaceId: string): Promise<GithubInboxPullRequestResponse[]> {
    return this.github.listInbox(workspaceId, INBOX_SHOWN);
  }

  /**
   * Links an inbox pull request to a task by its number, as you: you must be
   * able to edit that task. Audited. Status sync isn't applied; later events
   * for the pull request find the link and sync as usual.
   */
  async linkFromInbox(actor: Actor, access: WorkspaceAccess, itemId: string, taskNumber: number): Promise<GithubInboxPullRequestResponse> {
    const item = found(await this.github.findInboxItem(access.workspaceId, itemId), 'Pull request');
    let task;
    try {
      task = await this.tasksService.getByNumber(access.workspaceId, taskNumber);
    } catch (error) {
      if (error instanceof DomainError) throw DomainError.invalid(`There is no task #${taskNumber} you can see`);
      throw error;
    }
    if (!canInSpace(access, task.spaceId, 'task.update')) throw DomainError.forbidden('You need to be able to edit that task to link it');
    await this.github.upsertLink({ workspaceId: access.workspaceId, connectionId: item.connectionId, taskId: task.id, repo: item.repo, number: item.number, title: item.title, url: item.url, state: item.state, author: item.author, branch: item.branch });
    await this.github.deleteInboxItem(access.workspaceId, item.id);
    await this.auditLogger.record(actor, { action: 'github.pull_request.link', targetType: 'task', targetId: task.id, workspaceId: access.workspaceId, metadata: { repo: item.repo, number: item.number, taskNumber } });
    return item;
  }

  /** GitHub moves that were left for a person because the task was changed in TaskFlow. */
  async conflictsForTask(workspaceId: string, taskId: string): Promise<GithubSyncConflictResponse[]> {
    await this.tasksService.get(workspaceId, taskId);
    return this.github.listConflictsForTask(workspaceId, taskId);
  }

  /**
   * Settles a conflict: use GitHub's status (moves the task, as you) or keep the task as it
   * is. Either way sync now treats the task's status as its own, so the next event moves it
   * again. Needs edit rights on the task; audited.
   */
  async resolveConflict(actor: Actor, access: WorkspaceAccess, conflictId: string, useGithub: boolean): Promise<TaskResponse> {
    const conflict = found(await this.github.findConflict(access.workspaceId, conflictId), 'Conflict');
    const task = await this.tasksService.get(access.workspaceId, conflict.taskId);
    if (!canInSpace(access, task.spaceId, 'task.update')) throw DomainError.forbidden('You need to be able to edit this task to settle it');
    const settled = useGithub && task.status.id !== conflict.wantedStatus.id ? await this.tasksService.update(actor, access, task.id, { statusId: conflict.wantedStatus.id }) : task;
    await this.github.setSyncedStatus(access.workspaceId, conflict.connectionId, task.id, conflict.prNumber, settled.status.id);
    await this.github.deleteConflict(access.workspaceId, conflict.id);
    await this.auditLogger.record(actor, {
      action: 'github.conflict.resolve',
      targetType: 'task',
      targetId: task.id,
      workspaceId: access.workspaceId,
      metadata: { prNumber: conflict.prNumber, kept: useGithub ? 'github' : 'taskflow', status: settled.status.name },
    });
    return settled;
  }

  async dismissFromInbox(actor: Actor, access: WorkspaceAccess, itemId: string): Promise<boolean> {
    const item = found(await this.github.findInboxItem(access.workspaceId, itemId), 'Pull request');
    await this.github.deleteInboxItem(access.workspaceId, item.id);
    await this.auditLogger.record(actor, { action: 'github.pull_request.dismiss', targetType: 'integration', targetId: item.connectionId, workspaceId: access.workspaceId, metadata: { repo: item.repo, number: item.number } });
    return true;
  }

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
    if (connection.installationRef) throw DomainError.invalid('This repository is connected through the GitHub App: it has no webhook secret');
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

export function prefixOf(value: string | undefined): string {
  const prefix = (value ?? DEFAULT_TASK_PREFIX).trim().toUpperCase();
  if (!PREFIX.test(prefix)) throw DomainError.invalid('The task prefix is letters and digits, starting with a letter, like TF');
  return prefix;
}
