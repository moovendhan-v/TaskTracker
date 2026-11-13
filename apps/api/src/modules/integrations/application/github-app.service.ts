import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_GITHUB_SYNC,
  canInSpace,
  type GithubAppInfoResponse,
  type GithubConnectionResponse,
  type GithubInstallationResponse,
  type GithubIssueLinkResponse,
  type GithubSyncSettings,
} from '@taskflow/shared-types';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { AccessService } from '../../../core/access/access.service.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import { GithubApiError, GithubAppClient } from '../../../core/github-app/github-app.client.js';
import type { Actor, SessionUser, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import { GithubAppPolicy, isRepoName } from '../domain/github-app.policy.js';
import type { GithubInstallation, IssueLink } from '../domain/github-app.js';
import { GithubAppRepository } from '../domain/github-app.repository.js';
import { GithubRepository } from '../domain/github.repository.js';
import { CONNECTIONS_MAX, prefixOf } from './github-connections.service.js';
import { GithubMapper } from './github.mapper.js';

/** An install link works for this long. */
const STATE_TTL_MS = 10 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface InstallState {
  workspaceId: string;
  userId: string;
}

const connectionChange = { ...workspaceFromAccess, targetType: 'integration', metadata: (connection: GithubConnectionResponse) => ({ repo: connection.repo, viaApp: true }) };

/** Splits owner/name for a GitHub API path, each part encoded. */
export function repoPath(repo: string): string {
  // Never "." or ".." (which a URL would resolve as a path step).
  if (!isRepoName(repo)) throw new GithubApiError(0, 'Not a GitHub repository');
  const [owner, name] = repo.split('/');
  return `/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(name!)}`;
}

export function installationResponse(installation: GithubInstallation): GithubInstallationResponse {
  return { id: installation.id, accountLogin: installation.accountLogin, accountType: installation.accountType, createdAt: installation.createdAt.toISOString() };
}

export function issueLinkResponse(link: IssueLink & { repo: string }): GithubIssueLinkResponse {
  return { id: link.id, connectionId: link.connectionId, repo: link.repo, number: link.number, url: link.url, closed: link.syncedClosed, pending: link.pushDue, lastError: link.lastError };
}

/**
 * The TaskFlow GitHub App in a workspace (E2): installing it, choosing repositories, and
 * creating issues for tasks. Installing is checked with GitHub: the installation is kept only
 * if GitHub lists it among those the person who just installed it can reach, so nobody can
 * attach someone else's installation (and its repositories) to their workspace.
 */
@Injectable()
export class GithubAppService {
  private readonly stateKey: Buffer;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly client: GithubAppClient,
    private readonly apps: GithubAppRepository,
    private readonly github: GithubRepository,
    private readonly accessService: AccessService,
    private readonly transactional: TransactionalManager,
    private readonly tasksService: TasksService,
    private readonly auditLogger: AuditLogger,
  ) {
    this.stateKey = createHmac('sha256', env.BETTER_AUTH_SECRET).update('taskflow:github-app-install-state').digest();
  }

  info(): GithubAppInfoResponse {
    return { enabled: this.client.enabled, canInstall: this.client.canInstall, slug: this.client.enabled ? (this.env.GITHUB_APP_SLUG ?? null) : null, webhook: this.client.enabled && this.env.GITHUB_APP_WEBHOOK_SECRET !== undefined };
  }

  /** Where to send a person to install the app for this workspace; the link carries a signed state bound to them. */
  installUrl(actor: Actor, access: WorkspaceAccess): string {
    if (!this.client.canInstall) throw DomainError.invalid(this.client.enabled ? 'Installing from TaskFlow needs GITHUB_APP_CLIENT_SECRET on the server' : 'The GitHub App isn’t set up on this server');
    const url = new URL(`/apps/${encodeURIComponent(this.env.GITHUB_APP_SLUG!)}/installations/new`, this.env.GITHUB_OAUTH_URL);
    url.searchParams.set('state', this.signState({ workspaceId: access.workspaceId, userId: actor.userId }));
    return url.toString();
  }

  /**
   * GitHub sent the person back after installing (or changing) the app. Checks the state is
   * theirs and fresh, that they may still manage integrations in that workspace, and that
   * GitHub lists the installation among theirs; then keeps it. Returns the workspace, so the
   * caller can send them back to its settings. Throws DomainError with a short reason.
   */
  async finishInstall(user: SessionUser, params: { state: string; code: string; installationId: string }): Promise<string> {
    const state = this.readState(params.state);
    if (!state || state.userId !== user.id) throw DomainError.forbidden('This install link isn’t yours or has expired; start again from TaskFlow');
    const installationId = Number(params.installationId);
    if (!Number.isSafeInteger(installationId) || installationId < 1) throw DomainError.invalid('GitHub didn’t say which installation');
    const access = await this.accessService.resolve(user, state.workspaceId);
    if (!access?.permissions.has('integration.manage')) throw DomainError.forbidden('You can’t manage integrations in that workspace');

    let summary;
    try {
      const token = await this.client.exchangeCode(params.code);
      const listed = GithubAppPolicy.parseUserInstallations(await this.client.asUser(token, 'GET', '/user/installations?per_page=100'));
      summary = listed.find((installation) => installation.id === installationId);
    } catch (error) {
      if (error instanceof GithubApiError) throw DomainError.invalid('GitHub couldn’t confirm the installation; try again');
      throw error;
    }
    if (!summary) throw DomainError.forbidden('GitHub doesn’t list that installation as one you can reach');

    const actor: Actor = { userId: user.id, platformRole: user.platformRole, ip: null };
    await this.transactional.runInScope({ kind: 'workspace', workspaceId: state.workspaceId, userId: user.id, ...(access.spaceRules.length ? { spaceRules: access.spaceRules } : {}) }, async () => {
      const saved = await this.apps.saveInstallation({ workspaceId: state.workspaceId, installationId, accountLogin: summary.accountLogin, accountType: summary.accountType, installedById: user.id });
      await this.auditLogger.record(actor, {
        action: 'integration.github_app.install',
        targetType: 'integration',
        targetId: saved.id,
        workspaceId: state.workspaceId,
        metadata: { account: summary.accountLogin, installationId },
      });
    });
    return state.workspaceId;
  }

  /** The workspace a person's own, fresh install link is for; null for anyone else's or an expired one. */
  installWorkspace(user: SessionUser, state: string): string | null {
    const read = this.readState(state);
    return read && read.userId === user.id ? read.workspaceId : null;
  }

  async installations(workspaceId: string): Promise<GithubInstallationResponse[]> {
    return (await this.apps.listInstallations(workspaceId)).map(installationResponse);
  }

  /** The repositories an installation can reach, as GitHub says now. */
  async repositories(workspaceId: string, installationRef: string): Promise<string[]> {
    const installation = found(await this.apps.findInstallation(workspaceId, installationRef), 'Installation');
    try {
      return GithubAppPolicy.parseRepositories(await this.client.asInstallation(installation.installationId, 'GET', '/installation/repositories?per_page=100'));
    } catch (error) {
      if (error instanceof GithubApiError) throw DomainError.invalid(error.status === 404 ? 'The app was removed from that GitHub account; install it again' : 'GitHub didn’t answer; try again');
      throw error;
    }
  }

  /** Connects one of an installation's repositories; tasks are then moved as you. */
  @Audited('integration.github.connect', connectionChange)
  @Announces('integration.created', workspaceFromAccess)
  async connect(actor: Actor, access: WorkspaceAccess, request: { installationId: string; repo: string; taskPrefix?: string; sync?: Partial<GithubSyncSettings> }): Promise<GithubConnectionResponse> {
    const installation = found(UUID.test(request.installationId) ? await this.apps.findInstallation(access.workspaceId, request.installationId) : null, 'Installation');
    const reachable = await this.repositories(access.workspaceId, installation.id);
    const repo = reachable.find((name) => name.toLowerCase() === request.repo.trim().toLowerCase());
    if (!repo) throw DomainError.invalid('The app can’t reach that repository; choose one GitHub lists for this installation');
    const existing = await this.github.list(access.workspaceId);
    if (existing.length >= CONNECTIONS_MAX) throw DomainError.invalid(`A workspace can connect at most ${CONNECTIONS_MAX} repositories`);
    if (existing.some((connection) => connection.repo.toLowerCase() === repo.toLowerCase())) throw DomainError.conflict('That repository is already connected');
    const connection = await this.github.create({
      workspaceId: access.workspaceId,
      repo,
      taskPrefix: prefixOf(request.taskPrefix),
      sync: { ...DEFAULT_GITHUB_SYNC, ...request.sync },
      secretSealed: null,
      installationRef: installation.id,
      createdById: actor.userId,
    });
    return GithubMapper.toResponse(connection);
  }

  /** Forgets an installation in this workspace, with the repositories connected through it. Doesn't uninstall it on GitHub. */
  async removeInstallation(actor: Actor, access: WorkspaceAccess, installationRef: string): Promise<boolean> {
    const installation = found(await this.apps.findInstallation(access.workspaceId, installationRef), 'Installation');
    await this.apps.deleteInstallation(access.workspaceId, installation.id);
    await this.auditLogger.record(actor, {
      action: 'integration.github_app.remove',
      targetType: 'integration',
      targetId: installation.id,
      workspaceId: access.workspaceId,
      metadata: { account: installation.accountLogin },
    });
    return true;
  }

  /** Repositories connected through the app, where issues can be opened for tasks (names only). */
  async issueRepositories(workspaceId: string): Promise<{ connectionId: string; repo: string }[]> {
    return (await this.github.list(workspaceId)).filter((connection) => connection.installationRef !== null).map((connection) => ({ connectionId: connection.id, repo: connection.repo }));
  }

  async issuesForTask(workspaceId: string, taskId: string): Promise<GithubIssueLinkResponse[]> {
    await this.tasksService.get(workspaceId, taskId);
    return (await this.apps.listIssueLinksForTask(workspaceId, taskId)).map(issueLinkResponse);
  }

  /**
   * Opens a GitHub issue for a task in a repository connected through the app, and links the
   * two: from then on title and open / closed follow each other. Needs edit rights on the task.
   * The issue gets the task's title and its reference only, nothing else from TaskFlow.
   */
  async createIssue(actor: Actor, access: WorkspaceAccess, taskId: string, connectionId: string): Promise<GithubIssueLinkResponse> {
    const task = await this.tasksService.get(access.workspaceId, taskId);
    if (!canInSpace(access, task.spaceId, 'task.update')) throw DomainError.forbidden('You need to be able to edit this task to open an issue for it');
    const connection = found(await this.github.findInWorkspace(access.workspaceId, connectionId), 'Connection');
    if (!connection.installationRef) throw DomainError.invalid('Issues sync only for repositories connected through the GitHub App');
    const installation = found(await this.apps.findInstallation(access.workspaceId, connection.installationRef), 'Installation');
    if ((await this.apps.listIssueLinksForTask(access.workspaceId, task.id)).some((link) => link.connectionId === connection.id)) {
      throw DomainError.conflict('This task already has an issue in that repository');
    }
    let created;
    try {
      created = GithubAppPolicy.parseCreatedIssue(
        await this.client.asInstallation(installation.installationId, 'POST', `${repoPath(connection.repo)}/issues`, {
          title: task.title,
          body: `Tracked in TaskFlow as ${connection.taskPrefix}-${task.number}.`,
        }),
      );
    } catch (error) {
      if (error instanceof GithubApiError) {
        throw DomainError.invalid(error.status === 403 || error.status === 404 ? 'The app can’t open issues there: give it Issues “Read and write” on GitHub' : 'GitHub didn’t answer; try again');
      }
      throw error;
    }
    if (!created) throw DomainError.invalid('GitHub sent an unreadable answer; check the issue on GitHub');
    await this.apps.createIssueLink({ workspaceId: access.workspaceId, connectionId: connection.id, taskId: task.id, number: created.number, url: created.url, syncedTitle: task.title, syncedClosed: false, createdById: actor.userId });
    // A finished task closes its new issue (sent by the sync, like any other change).
    await this.apps.markPushDue(access.workspaceId, task.id);
    await this.auditLogger.record(actor, { action: 'github.issue.create', targetType: 'task', targetId: task.id, workspaceId: access.workspaceId, metadata: { repo: connection.repo, number: created.number } });
    const link = (await this.apps.listIssueLinksForTask(access.workspaceId, task.id)).find((item) => item.number === created.number && item.connectionId === connection.id)!;
    return issueLinkResponse(link);
  }

  private signState(state: InstallState): string {
    const payload = Buffer.from(JSON.stringify({ w: state.workspaceId, u: state.userId, e: Date.now() + STATE_TTL_MS, n: randomBytes(8).toString('hex') })).toString('base64url');
    return `${payload}.${createHmac('sha256', this.stateKey).update(payload).digest('base64url')}`;
  }

  private readState(value: string): InstallState | null {
    const [payload, signature] = value.split('.');
    if (!payload || !signature || value.length > 500) return null;
    const expected = Buffer.from(createHmac('sha256', this.stateKey).update(payload).digest('base64url'));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { w?: unknown; u?: unknown; e?: unknown };
      if (typeof parsed.w !== 'string' || !UUID.test(parsed.w) || typeof parsed.u !== 'string' || typeof parsed.e !== 'number' || parsed.e < Date.now()) return null;
      return { workspaceId: parsed.w, userId: parsed.u };
    } catch {
      return null;
    }
  }
}
