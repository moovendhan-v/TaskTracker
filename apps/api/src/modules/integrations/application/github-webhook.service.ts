import { Injectable, Logger } from '@nestjs/common';
import { canInSpace, taskReferences, type AutomationTriggerType, type StatusCategory, type TaskResponse } from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { SecretBox } from '../../../core/crypto/secret-box.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../core/time/clock.port.js';
import { AutomationEngine } from '../../automations/application/automation-engine.js';
import { StatusesService } from '../../statuses/application/statuses.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import { GithubWebhookPolicy, type PullRequestEvent } from '../domain/github-webhook.policy.js';
import type { GithubConnection } from '../domain/github.js';
import { GithubRepository } from '../domain/github.repository.js';

export interface WebhookDelivery {
  connectionId: string;
  /** X-GitHub-Event */
  event: string | undefined;
  /** X-GitHub-Delivery */
  deliveryId: string | undefined;
  /** X-Hub-Signature-256 */
  signature: string | undefined;
  rawBody: Buffer;
}

/** invalid: unknown connection or bad signature (401). The rest are 2xx for GitHub. */
export type WebhookOutcome = 'invalid' | 'ok' | 'duplicate' | 'ignored';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELIVERY_ID = /^[A-Za-z0-9-]{1,64}$/;
const CLOSED: readonly StatusCategory[] = ['done', 'cancelled'];

/**
 * Handles GitHub webhook deliveries for one connection: checks the signature
 * against the raw body, handles each delivery once, links pull requests to the
 * tasks they mention (TF-42), moves those tasks as configured and fires the
 * GitHub automation triggers. Everything for one delivery is one transaction.
 */
@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);

  constructor(
    private readonly github: GithubRepository,
    private readonly secretBox: SecretBox,
    private readonly unitOfWork: UnitOfWork,
    private readonly transactional: TransactionalManager,
    private readonly tasksService: TasksService,
    private readonly statusesService: StatusesService,
    private readonly accessService: AccessService,
    private readonly automationEngine: AutomationEngine,
    private readonly clock: Clock,
  ) {}

  async receive(delivery: WebhookDelivery): Promise<WebhookOutcome> {
    if (!UUID.test(delivery.connectionId)) return 'invalid';
    // The connection id is all the request carries, so finding its workspace needs one platform-scope read.
    const workspaceId = await this.unitOfWork.runInScope({ kind: 'platform' }, () => this.github.findWorkspaceOf(delivery.connectionId));
    if (!workspaceId) return 'invalid';

    return this.unitOfWork.runInScope({ kind: 'workspace', workspaceId, userId: null }, async () => {
      const connection = await this.github.findInWorkspace(workspaceId, delivery.connectionId);
      // Repositories connected through the GitHub App have no webhook of their own.
      if (!connection?.secretSealed) return 'invalid';
      let secret: string;
      try {
        secret = this.secretBox.open(connection.secretSealed);
      } catch {
        await this.note(connection, 'secret unreadable: replace it');
        return 'invalid';
      }
      if (!GithubWebhookPolicy.signatureMatches(secret, delivery.rawBody, delivery.signature)) {
        await this.note(connection, 'bad signature');
        return 'invalid';
      }
      if (!delivery.deliveryId || !DELIVERY_ID.test(delivery.deliveryId)) return 'ignored';
      if (!(await this.github.claimDelivery(workspaceId, connection.id, delivery.deliveryId))) return 'duplicate';

      const event = (delivery.event ?? '').slice(0, 40);
      if (event === 'ping') {
        await this.note(connection, 'ok: connected', { event });
        return 'ok';
      }
      if (event !== 'pull_request') {
        await this.note(connection, `ignored: ${event || 'unknown'} event`, { event: event || 'unknown' });
        return 'ignored';
      }
      let payload: unknown;
      try {
        payload = JSON.parse(delivery.rawBody.toString('utf8'));
      } catch {
        await this.note(connection, 'ignored: not JSON (set the content type to application/json)', { event });
        return 'ignored';
      }
      const pr = GithubWebhookPolicy.parsePullRequest(payload);
      if (!pr) {
        await this.note(connection, 'ignored: unreadable pull request', { event });
        return 'ignored';
      }
      if (pr.repo.toLowerCase() !== connection.repo.toLowerCase()) {
        await this.note(connection, `ignored: from ${pr.repo.slice(0, 50)}`, { event, prNumber: pr.number });
        return 'ignored';
      }
      return this.applyPullRequest(connection, pr, event);
    });
  }

  /**
   * Applies one pull request change to the connection's tasks, as the connection's owner (with
   * their access now), and records it in the sync log. Used by webhooks and by the GitHub App
   * poller. Runs in the workspace's scope.
   */
  async applyPullRequest(connection: GithubConnection, pr: PullRequestEvent, event: string): Promise<'ok' | 'ignored'> {
    const { workspaceId } = connection;
    // Everything a delivery does is limited to what the connection's owner can see now.
    const access = connection.createdById ? await this.accessService.resolveMember(connection.createdById, workspaceId) : null;
    if (!access) {
      await this.note(connection, 'ignored: the owner left; save the connection again', { event, prNumber: pr.number });
      return 'ignored';
    }
    const { linked, conflicts } = await this.handlePullRequest(connection, access, pr);
    const asked = conflicts ? `, ${conflicts} left as ${conflicts === 1 ? 'a conflict' : 'conflicts'} (changed in TaskFlow)` : '';
    await this.note(connection, `ok: #${pr.number} ${pr.action}, ${linked.length} linked${linked.length ? '' : ' (in the pull request inbox)'}${asked}`, { event, prNumber: pr.number, taskNumbers: linked });
    return 'ok';
  }

  /** Records something the GitHub App poller did, in the connection's sync log. */
  noteSync(connection: GithubConnection, status: string, details: { event?: string; prNumber?: number; taskNumbers?: number[] } = {}): Promise<void> {
    return this.note(connection, status, details);
  }

  /**
   * Links the pull request to every task it mentions; returns the linked task
   * numbers. A pull request that links to nothing waits in the inbox, where
   * someone can link it by hand.
   */
  private async handlePullRequest(connection: GithubConnection, access: WorkspaceAccess, pr: PullRequestEvent): Promise<{ linked: number[]; conflicts: number }> {
    const { workspaceId } = connection;
    const trigger: AutomationTriggerType | null =
      pr.action === 'closed'
        ? pr.state === 'merged'
          ? 'github_pull_request_merged'
          : 'github_pull_request_closed'
        : ['opened', 'reopened', 'ready_for_review'].includes(pr.action)
          ? 'github_pull_request_opened'
          : null;
    const category =
      trigger === 'github_pull_request_merged'
        ? connection.sync.onMerged
        : trigger === 'github_pull_request_opened'
          ? connection.sync.onOpened
          : trigger === 'github_pull_request_closed'
            ? (connection.sync.onClosed ?? null)
            : null;

    const linked: number[] = [];
    let conflicts = 0;
    for (const number of taskReferences(connection.taskPrefix, pr.title, pr.body, pr.branch)) {
      let task: TaskResponse;
      try {
        task = await this.tasksService.getByNumber(workspaceId, number);
      } catch (error) {
        if (error instanceof DomainError) continue;
        throw error;
      }
      if (!canInSpace(access, task.spaceId, 'task.view')) continue;
      await this.github.upsertLink({
        workspaceId,
        connectionId: connection.id,
        taskId: task.id,
        repo: connection.repo,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: pr.state,
        author: pr.author,
        branch: pr.branch,
      });
      linked.push(number);
      if (category && (await this.moveTo(connection, access, task, category, pr)) === 'conflict') conflicts += 1;
      if (trigger) await this.automationEngine.run(workspaceId, [trigger], task.id, { actorId: null, pr: `${pr.title} (#${pr.number})` });
    }
    if (linked.length) await this.github.removeFromInbox(workspaceId, connection.id, pr.number);
    else await this.github.upsertInbox({ workspaceId, connectionId: connection.id, repo: connection.repo, number: pr.number, title: pr.title, url: pr.url, author: pr.author, branch: pr.branch, state: pr.state });
    return { linked, conflicts };
  }

  /**
   * Moves a task to the first status of its space with this meaning, as the connection's owner.
   * If someone moved the task by hand since sync last did, it isn't overwritten: the move is
   * left as a conflict for a person to settle (E2).
   */
  private async moveTo(connection: GithubConnection, access: WorkspaceAccess, task: TaskResponse, category: StatusCategory, pr: PullRequestEvent): Promise<'moved' | 'conflict' | 'unchanged'> {
    const key = [connection.workspaceId, connection.id, task.id, pr.number] as const;
    const synced = await this.github.syncedStatus(...key);
    const remember = (statusId: string) => this.github.setSyncedStatus(...key, statusId);
    if (task.status.category === category) {
      await remember(task.status.id);
      return 'unchanged';
    }
    // An opened pull request doesn't reopen finished work.
    if (CLOSED.includes(task.status.category) && !CLOSED.includes(category)) {
      if (!synced) await remember(task.status.id);
      return 'unchanged';
    }
    if (!connection.createdById || !canInSpace(access, task.spaceId, 'task.update')) return 'unchanged';
    const target = (await this.statusesService.listForSpace(connection.workspaceId, task.spaceId)).find((status) => status.category === category);
    if (!target) return 'unchanged';
    if (synced && synced !== task.status.id) {
      await this.github.upsertConflict({ workspaceId: connection.workspaceId, connectionId: connection.id, taskId: task.id, prNumber: pr.number, prTitle: pr.title, prUrl: pr.url, event: pr.state, wantedStatusId: target.id });
      return 'conflict';
    }
    const actor = { userId: connection.createdById, platformRole: 'USER' as const, ip: null };
    try {
      await this.transactional.savepoint(() =>
        this.transactional.runInScope({ kind: 'workspace', workspaceId: connection.workspaceId, userId: actor.userId, spaceRules: access.spaceRules }, () =>
          this.tasksService.update(actor, access, task.id, { statusId: target.id }),
        ),
      );
      await remember(target.id);
      return 'moved';
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      this.logger.warn(`GitHub connection ${connection.id} could not move task ${task.id}: ${error.message}`);
      return 'unchanged';
    }
  }

  /** The connection's last status, and a sync log entry with our own short text (never payload content). */
  private async note(connection: GithubConnection, status: string, details: { event?: string; prNumber?: number; taskNumbers?: number[] } = {}): Promise<void> {
    // Only the delivery columns: the poller keeps its cursors on the same row.
    await this.github.noteDelivery(connection.workspaceId, connection.id, this.clock.now(), status.slice(0, 80));
    const outcome = status.startsWith('ok') ? 'ok' : status.startsWith('ignored') ? 'ignored' : 'error';
    await this.github.logEvent({
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      event: details.event ?? 'delivery',
      outcome,
      detail: status,
      prNumber: details.prNumber ?? null,
      taskNumbers: details.taskNumbers ?? [],
    });
  }
}
