import { Injectable, Logger } from '@nestjs/common';
import { canInSpace, taskReferences, type AutomationTriggerType, type StatusCategory, type TaskResponse } from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { SecretBox } from '../../../core/crypto/secret-box.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
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
      if (!connection) return 'invalid';
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
        await this.note(connection, 'ok: connected');
        return 'ok';
      }
      if (event !== 'pull_request') {
        await this.note(connection, `ignored: ${event || 'unknown'} event`);
        return 'ignored';
      }
      let payload: unknown;
      try {
        payload = JSON.parse(delivery.rawBody.toString('utf8'));
      } catch {
        await this.note(connection, 'ignored: not JSON (set the content type to application/json)');
        return 'ignored';
      }
      const pr = GithubWebhookPolicy.parsePullRequest(payload);
      if (!pr) {
        await this.note(connection, 'ignored: unreadable pull request');
        return 'ignored';
      }
      if (pr.repo.toLowerCase() !== connection.repo.toLowerCase()) {
        await this.note(connection, `ignored: from ${pr.repo.slice(0, 50)}`);
        return 'ignored';
      }
      const linked = await this.handlePullRequest(connection, pr);
      await this.note(connection, `ok: #${pr.number} ${pr.action}, ${linked} linked`);
      return 'ok';
    });
  }

  /** Links the pull request to every task it mentions; returns how many. */
  private async handlePullRequest(connection: GithubConnection, pr: PullRequestEvent): Promise<number> {
    const { workspaceId } = connection;
    const trigger: AutomationTriggerType | null =
      pr.action === 'closed'
        ? pr.state === 'merged'
          ? 'github_pull_request_merged'
          : 'github_pull_request_closed'
        : ['opened', 'reopened', 'ready_for_review'].includes(pr.action)
          ? 'github_pull_request_opened'
          : null;
    const category = trigger === 'github_pull_request_merged' ? connection.sync.onMerged : trigger === 'github_pull_request_opened' ? connection.sync.onOpened : null;

    let linked = 0;
    for (const number of taskReferences(connection.taskPrefix, pr.title, pr.body, pr.branch)) {
      let task: TaskResponse;
      try {
        task = await this.tasksService.getByNumber(workspaceId, number);
      } catch (error) {
        if (error instanceof DomainError) continue;
        throw error;
      }
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
      linked += 1;
      if (category) await this.moveTo(connection, task, category);
      if (trigger) await this.automationEngine.run(workspaceId, [trigger], task.id, { actorId: null, pr: `${pr.title} (#${pr.number})` });
    }
    return linked;
  }

  /** Moves a task to the first status of its space with this meaning, as the connection's owner. */
  private async moveTo(connection: GithubConnection, task: TaskResponse, category: StatusCategory): Promise<void> {
    if (task.status.category === category) return;
    // An opened pull request doesn't reopen finished work.
    if (CLOSED.includes(task.status.category) && !CLOSED.includes(category)) return;
    if (!connection.createdById) return;
    const access = await this.accessService.resolveMember(connection.createdById, connection.workspaceId);
    if (!access || !canInSpace(access, task.spaceId, 'task.update')) return;
    const target = (await this.statusesService.listForSpace(connection.workspaceId, task.spaceId)).find((status) => status.category === category);
    if (!target) return;
    const actor = { userId: connection.createdById, platformRole: 'USER' as const, ip: null };
    try {
      await this.transactional.savepoint(() =>
        this.transactional.runInScope({ kind: 'workspace', workspaceId: connection.workspaceId, userId: actor.userId, spaceRules: access.spaceRules }, () =>
          this.tasksService.update(actor, access, task.id, { statusId: target.id }),
        ),
      );
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      this.logger.warn(`GitHub connection ${connection.id} could not move task ${task.id}: ${error.message}`);
    }
  }

  private async note(connection: GithubConnection, status: string): Promise<void> {
    await this.github.save({ ...connection, lastDeliveryAt: this.clock.now(), lastDeliveryStatus: status.slice(0, 80) });
  }
}
