import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { TASK_TITLE_MAX, canInSpace, type PullRequestState, type StatusCategory, type TaskResponse, type UpdateTaskRequest } from '@taskflow/shared-types';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { AccessService } from '../../../core/access/access.service.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { GithubApiError, GithubAppClient } from '../../../core/github-app/github-app.client.js';
import type { WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { EventStream } from '../../../core/realtime/event-stream.js';
import { Clock } from '../../../core/time/clock.port.js';
import { CustomFieldsService } from '../../custom-fields/application/custom-fields.service.js';
import { StatusesService } from '../../statuses/application/statuses.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import { GithubAppPolicy, type PolledIssue, type PolledPull } from '../domain/github-app.policy.js';
import type { AppConnectionRef, IssuePush } from '../domain/github-app.js';
import { GithubAppRepository } from '../domain/github-app.repository.js';
import type { GithubConnection } from '../domain/github.js';
import { GithubRepository } from '../domain/github.repository.js';
import { repoPath } from './github-app.service.js';
import { GithubWebhookService } from './github-webhook.service.js';

/** Bounds on one tick, so a backlog drains over several ticks. */
const WORKSPACES_PER_TICK = 100;
const CONNECTIONS_PER_WORKSPACE = 20;
const PUSHES_PER_WORKSPACE = 50;
/** A leased push isn't picked up again for this long, even if this instance dies mid-send. */
const PUSH_LEASE_MS = 2 * 60_000;
/** Waits before the next tries of a push that failed for a passing reason; then it's given up. */
const PUSH_RETRY_MS = [60_000, 5 * 60_000, 15 * 60_000];
const CLOSED: readonly StatusCategory[] = ['done', 'cancelled'];

/**
 * Two-way sync for repositories connected through the GitHub App (E2):
 *
 * - Every GITHUB_SYNC_POLL_SECONDS it asks GitHub for pull requests and issues changed since
 *   the last look. Pull requests go through the same handling as webhooks (links, inbox,
 *   status moves, conflicts, automations); a linked issue's title and open / closed state
 *   move its task, unless the task changed too (then TaskFlow's change wins and is sent).
 * - A task change reaches GitHub straight away: after it commits, the task's issue links
 *   whose title or state no longer match what sync last agreed on are marked and sent.
 *
 * Finding which workspaces have work is the only platform-scope read. Several API instances
 * can run this at once: connections and pushes are claimed (SKIP LOCKED) by one of them.
 * Network calls happen outside database transactions.
 */
@Injectable()
export class GithubAppSync implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GithubAppSync.name);
  private timer: NodeJS.Timeout | null = null;
  private unlisten: (() => void) | null = null;
  private ticking = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly client: GithubAppClient,
    private readonly apps: GithubAppRepository,
    private readonly github: GithubRepository,
    private readonly webhooks: GithubWebhookService,
    private readonly tasksService: TasksService,
    private readonly statusesService: StatusesService,
    private readonly accessService: AccessService,
    private readonly transactional: TransactionalManager,
    private readonly stream: EventStream,
    private readonly clock: Clock,
    private readonly customFields: CustomFieldsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.client.enabled) return;
    this.unlisten = this.stream.listen((event) => {
      if (event.entityType === 'task' && event.type === 'task.updated') void this.taskChanged(event.workspaceId, event.entityId);
    });
    if (this.env.GITHUB_SYNC_POLL_SECONDS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.env.GITHUB_SYNC_POLL_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.unlisten?.();
    this.timer = null;
  }

  /** A task changed (committed): send it to its issues if they now differ. Never throws. */
  async taskChanged(workspaceId: string, taskId: string): Promise<void> {
    try {
      const marked = await this.transactional.runInScope({ kind: 'workspace', workspaceId, userId: null }, () => this.apps.markPushDue(workspaceId, taskId));
      if (marked > 0) await this.push(workspaceId);
    } catch (error) {
      this.logger.warn(`Couldn’t queue a GitHub issue update: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /** One pass: polls due connections and sends due pushes, workspace by workspace. Never throws. */
  async tick(): Promise<void> {
    if (this.ticking || !this.client.enabled) return;
    this.ticking = true;
    try {
      const now = this.clock.now();
      const polledBefore = new Date(now.getTime() - Math.max(1, this.env.GITHUB_SYNC_POLL_SECONDS) * 1000 + 500);
      const workspaces = await this.transactional.runInScope({ kind: 'platform' }, () => this.apps.workspacesToSync(now, polledBefore, WORKSPACES_PER_TICK));
      for (const workspaceId of workspaces) {
        try {
          const claims = await this.inWorkspace(workspaceId, () => this.apps.claimPolls(workspaceId, now, polledBefore, CONNECTIONS_PER_WORKSPACE));
          for (const claim of claims) await this.poll(workspaceId, claim);
          await this.push(workspaceId);
        } catch (error) {
          this.logger.error('GitHub sync failed for a workspace', error instanceof Error ? error.stack : undefined);
        }
      }
    } catch (error) {
      this.logger.error('GitHub sync tick failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.ticking = false;
    }
  }

  private inWorkspace<T>(workspaceId: string, work: () => Promise<T>): Promise<T> {
    return this.transactional.runInScope({ kind: 'workspace', workspaceId, userId: null }, work);
  }

  /** Reads one connection's changes from GitHub, then applies them in one transaction. */
  private async poll(workspaceId: string, claim: AppConnectionRef): Promise<void> {
    const connection = await this.inWorkspace(workspaceId, () => this.github.findInWorkspace(workspaceId, claim.connectionId));
    if (!connection) return;
    const first = connection.pullsCursor === null;
    let pulls: PolledPull[];
    let issues: PolledIssue[];
    try {
      const base = repoPath(connection.repo);
      const pullList = await this.client.asInstallation(claim.installationId, 'GET', `${base}/pulls?state=all&sort=updated&direction=desc&per_page=50`);
      pulls = (Array.isArray(pullList) ? pullList : [])
        .map((item) => GithubAppPolicy.parsePull(item, connection.repo))
        .filter((pull): pull is PolledPull => pull !== null && (connection.pullsCursor === null || pull.updatedAt > connection.pullsCursor))
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
      if (first) {
        issues = [];
      } else {
        const since = encodeURIComponent((connection.issuesCursor ?? connection.createdAt).toISOString());
        const issueList = await this.client.asInstallation(claim.installationId, 'GET', `${base}/issues?state=all&sort=updated&direction=asc&since=${since}&per_page=100`);
        issues = (Array.isArray(issueList) ? issueList : [])
          .map((item) => GithubAppPolicy.parseIssue(item))
          .filter((issue): issue is PolledIssue => issue !== null && (connection.issuesCursor === null || issue.updatedAt > connection.issuesCursor));
      }
    } catch (error) {
      const reason = error instanceof GithubApiError ? (error.status === 404 ? 'the app can’t reach this repository (removed from the installation?)' : error.rateLimited ? 'GitHub asked us to slow down' : error.message) : 'unknown error';
      await this.inWorkspace(workspaceId, () => this.webhooks.noteSync(connection, `error: ${reason}`.slice(0, 80), { event: 'poll' }));
      return;
    }
    if (!first && pulls.length === 0 && issues.length === 0) return;

    await this.inWorkspace(workspaceId, async () => {
      for (const pull of pulls) {
        // The first look only records what's there (links and the inbox), without moving tasks.
        const action = first ? 'edited' : actionFor(await this.apps.knownPullState(workspaceId, connection.id, pull.number), pull.state);
        await this.transactional.savepoint(() => this.webhooks.applyPullRequest(connection, { ...pull, action }, 'pull_request'));
      }
      for (const issue of issues) await this.transactional.savepoint(() => this.applyIssue(connection, issue));
      const pullsCursor = pulls.at(-1)?.updatedAt ?? (first ? this.clock.now() : undefined);
      const issuesCursor = issues.length ? issues.reduce((latest, issue) => (issue.updatedAt > latest ? issue.updatedAt : latest), issues[0]!.updatedAt) : first ? this.clock.now() : undefined;
      await this.apps.setCursors(workspaceId, connection.id, { ...(pullsCursor && { pullsCursor }), ...(issuesCursor && { issuesCursor }) });
      if (first) await this.webhooks.noteSync(connection, `ok: connected through the GitHub App, ${pulls.length} pull request${pulls.length === 1 ? '' : 's'} read`, { event: 'poll' });
    });
  }

  /**
   * A linked issue changed on GitHub: its title, open / closed state, labels (into the
   * connection's labels field, adding options for new label names) and assignee (the
   * member who signed in with that GitHub account) move the task. An assignee nobody
   * here is linked to leaves the task's alone. Runs in the workspace's scope.
   */
  async applyIssue(connection: GithubConnection, issue: PolledIssue): Promise<void> {
    const { workspaceId } = connection;
    const link = await this.apps.findIssueLink(workspaceId, connection.id, issue.number);
    if (!link) return;
    const title = issue.title.trim().slice(0, TASK_TITLE_MAX);
    const titleChanged = title !== link.syncedTitle && title.length > 0;
    const closedChanged = issue.closed !== link.syncedClosed;
    const labelsFieldId = connection.sync.labelsFieldId ?? null;
    const labels = labelsFieldId && issue.labels !== null ? await this.customFields.optionIdsFor(workspaceId, labelsFieldId, issue.labels) : null;
    const labelsChanged = labels !== null && !sameList(labels.ids, link.syncedLabels);
    const assigneeId = issue.assigneeGithubId === undefined ? undefined : issue.assigneeGithubId === null ? null : await this.apps.memberForGithubId(workspaceId, issue.assigneeGithubId);
    // Someone not linked to anyone here: leave the task's assignee as it is.
    const assigneeKnown = assigneeId !== undefined && !(issue.assigneeGithubId && assigneeId === null);
    const assigneeChanged = assigneeKnown && assigneeId !== link.syncedAssigneeId;
    if (!titleChanged && !closedChanged && !labelsChanged && !assigneeChanged) return;
    if (link.pushDue) {
      // Changed on both sides since sync last agreed: TaskFlow's change wins and is sent.
      await this.webhooks.noteSync(connection, `ok: issue #${issue.number} changed on both sides; kept TaskFlow's`, { event: 'issues' });
      return;
    }
    const access = connection.createdById ? await this.accessService.resolveMember(connection.createdById, workspaceId) : null;
    let task: TaskResponse;
    try {
      task = await this.tasksService.get(workspaceId, link.taskId);
    } catch (error) {
      if (error instanceof DomainError) return;
      throw error;
    }
    if (!access || !canInSpace(access, task.spaceId, 'task.update')) {
      await this.webhooks.noteSync(connection, `ignored: issue #${issue.number}: the connection's owner can't edit ${connection.taskPrefix}-${task.number}`, { event: 'issues' });
      return;
    }
    const canAssign = canInSpace(access, task.spaceId, 'task.assign');
    const statusId = closedChanged ? await this.statusFor(access, task, issue.closed) : null;
    const changes: UpdateTaskRequest = {
      ...(titleChanged && { title }),
      ...(statusId && statusId !== task.status.id && { statusId }),
      ...(labelsChanged && labelsFieldId && { customFields: { [labelsFieldId]: labels!.ids.length ? labels!.ids : null } }),
      ...(assigneeChanged && canAssign && assigneeId !== task.assigneeId && { assigneeId: assigneeId ?? null }),
    };
    // What sync now agrees on is set first, so the task change that follows isn't sent back.
    await this.apps.setSynced(workspaceId, link.id, {
      title: titleChanged ? title : link.syncedTitle,
      closed: issue.closed,
      labels: labelsChanged ? labels!.ids : link.syncedLabels,
      assigneeId: assigneeChanged && canAssign ? (assigneeId ?? null) : link.syncedAssigneeId,
    });
    if (Object.keys(changes).length) {
      const actor = { userId: connection.createdById!, platformRole: 'USER' as const, ip: null };
      await this.transactional.runInScope({ kind: 'workspace', workspaceId, userId: actor.userId, ...(access.spaceRules.length ? { spaceRules: access.spaceRules } : {}) }, () =>
        this.tasksService.update(actor, access, task.id, changes),
      );
    }
    const what = [
      titleChanged && 'renamed',
      closedChanged && (issue.closed ? 'closed' : 'reopened'),
      labelsChanged && `labelled${labels!.added.length ? ` (new: ${labels!.added.join(', ')})` : ''}`,
      assigneeChanged && (canAssign ? 'reassigned' : 'reassigned (not applied: the owner can’t assign)'),
    ]
      .filter(Boolean)
      .join(' and ');
    await this.webhooks.noteSync(connection, `ok: issue #${issue.number} ${what}, ${connection.taskPrefix}-${task.number} updated`.slice(0, 200), { event: 'issues', taskNumbers: [task.number] });
  }

  /**
   * A GitHub user's login from their (stable) id, which the account link stores; GitHub's
   * issue API assigns by login. Null when GitHub doesn't answer with one.
   */
  private async githubLogin(installationId: number, githubUserId: string): Promise<string | null> {
    if (!/^\d{1,20}$/.test(githubUserId)) return null;
    const user = await this.client.asInstallation(installationId, 'GET', `/user/${githubUserId}`);
    const login = user && typeof user === 'object' ? (user as Record<string, unknown>)['login'] : null;
    return typeof login === 'string' && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login) ? login : null;
  }

  /** The status a closed (or reopened) issue moves its task to: the first done one, or the first not-started one. */
  private async statusFor(access: WorkspaceAccess, task: TaskResponse, closed: boolean): Promise<string | null> {
    if (CLOSED.includes(task.status.category) === closed) return null;
    const statuses = await this.statusesService.listForSpace(access.workspaceId, task.spaceId);
    return statuses.find((status) => status.category === (closed ? 'done' : 'unstarted'))?.id ?? null;
  }

  /** Sends due pushes: each issue gets its task's title, open / closed state, labels and assignee. */
  private async push(workspaceId: string): Promise<void> {
    const now = this.clock.now();
    const pushes = await this.inWorkspace(workspaceId, () => this.apps.leasePushes(workspaceId, now, new Date(now.getTime() + PUSH_LEASE_MS), PUSHES_PER_WORKSPACE));
    for (const job of pushes) await this.send(workspaceId, job);
  }

  private async send(workspaceId: string, job: IssuePush): Promise<void> {
    try {
      const body: Record<string, unknown> = { title: job.title, state: job.closed ? 'closed' : 'open' };
      // Labels only where the labels field applies to the task; GitHub creates labels it doesn't have yet.
      if (job.labelsApply && !sameList(job.labelIds, job.link.syncedLabels)) body['labels'] = job.labelNames;
      // The assignee by GitHub login, when they signed in with GitHub; unassigning clears it there too.
      if (job.assigneeId !== job.link.syncedAssigneeId) {
        if (job.assigneeId === null) body['assignees'] = [];
        else if (job.assigneeGithubId) {
          const login = await this.githubLogin(job.installationId, job.assigneeGithubId);
          if (login) body['assignees'] = [login];
        }
      }
      await this.client.asInstallation(job.installationId, 'PATCH', `${repoPath(job.repo)}/issues/${job.link.number}`, body);
      await this.inWorkspace(workspaceId, () =>
        this.apps.pushed(workspaceId, job.link.id, job.link.pushVersion, { title: job.title, closed: job.closed, labels: job.labelsApply ? job.labelIds : job.link.syncedLabels, assigneeId: job.assigneeId }),
      );
    } catch (error) {
      const status = error instanceof GithubApiError ? error.status : 0;
      const final = [401, 403, 404, 410, 422].includes(status) && !(error instanceof GithubApiError && error.rateLimited);
      const reason =
        status === 404 || status === 410
          ? 'The issue or repository is gone on GitHub'
          : status === 403 || status === 401
            ? 'The app can’t edit issues there: give it Issues “Read and write” on GitHub'
            : status === 422
              ? 'GitHub refused the change'
              : 'GitHub didn’t answer';
      const wait = PUSH_RETRY_MS[job.link.pushAttempts - 1];
      const retryAt = final || wait === undefined ? null : new Date(this.clock.now().getTime() + wait);
      await this.inWorkspace(workspaceId, () => this.apps.pushFailed(workspaceId, job.link.id, retryAt ? `${reason}; trying again` : reason, retryAt));
    }
  }
}

/** Two sorted lists of ids are the same. */
export function sameList(a: readonly string[], b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** What happened to a pull request, judged from the state TaskFlow last recorded for it. */
export function actionFor(known: PullRequestState | null, now: PullRequestState): string {
  if (known === now) return 'edited';
  if (now === 'open') return known === null ? 'opened' : 'reopened';
  return 'closed';
}
