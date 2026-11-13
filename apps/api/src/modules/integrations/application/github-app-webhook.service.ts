import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { GithubAppClient } from '../../../core/github-app/github-app.client.js';
import { GithubAppPolicy, isRepoName } from '../domain/github-app.policy.js';
import { GithubAppRepository } from '../domain/github-app.repository.js';
import { GithubWebhookPolicy } from '../domain/github-webhook.policy.js';
import { GithubRepository } from '../domain/github.repository.js';
import { GithubAppSync } from './github-app-sync.js';
import { GithubWebhookService, type WebhookOutcome } from './github-webhook.service.js';

const DELIVERY_ID = /^[A-Za-z0-9-]{1,64}$/;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * The GitHub App's own webhook (E2): one URL for every installation, signed with
 * GITHUB_APP_WEBHOOK_SECRET. Pull request and issue events reach the connections for that
 * repository and installation at once (the poller stays on as a safety net, and handles
 * nothing twice); an uninstall on GitHub forgets the installation everywhere.
 */
@Injectable()
export class GithubAppWebhookService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly client: GithubAppClient,
    private readonly apps: GithubAppRepository,
    private readonly github: GithubRepository,
    private readonly webhooks: GithubWebhookService,
    private readonly sync: GithubAppSync,
    private readonly transactional: TransactionalManager,
  ) {}

  async receive(delivery: { event: string | undefined; deliveryId: string | undefined; signature: string | undefined; rawBody: Buffer }): Promise<WebhookOutcome> {
    const secret = this.env.GITHUB_APP_WEBHOOK_SECRET;
    // No secret configured: the webhook is off, and nothing unsigned is accepted.
    if (!secret || !this.client.enabled || !GithubWebhookPolicy.signatureMatches(secret, delivery.rawBody, delivery.signature)) return 'invalid';
    if (!delivery.deliveryId || !DELIVERY_ID.test(delivery.deliveryId)) return 'ignored';
    let payload: Record<string, unknown>;
    try {
      payload = record(JSON.parse(delivery.rawBody.toString('utf8')));
    } catch {
      return 'ignored';
    }
    const event = (delivery.event ?? '').slice(0, 40);
    const installationId = record(payload['installation'])['id'];
    if (event === 'ping') return 'ok';
    if (typeof installationId !== 'number' || !Number.isSafeInteger(installationId) || installationId < 1) return 'ignored';

    if (event === 'installation' && payload['action'] === 'deleted') {
      this.client.forget(installationId);
      await this.transactional.runInScope({ kind: 'platform' }, () => this.apps.deleteInstallationEverywhere(installationId));
      return 'ok';
    }
    if (event !== 'pull_request' && event !== 'issues') return 'ignored';

    const repo = String(record(payload['repository'])['full_name'] ?? '').slice(0, 201);
    if (!isRepoName(repo)) return 'ignored';
    const targets = await this.transactional.runInScope({ kind: 'platform' }, () => this.apps.connectionsForRepo(installationId, repo));
    if (targets.length === 0) return 'ignored';

    const pr = event === 'pull_request' ? GithubWebhookPolicy.parsePullRequest(payload) : null;
    const issue = event === 'issues' ? GithubAppPolicy.parseIssue(payload['issue']) : null;
    if (!pr && !issue) return 'ignored';

    let handled = false;
    for (const target of targets) {
      await this.transactional.runInScope({ kind: 'workspace', workspaceId: target.workspaceId, userId: null }, async () => {
        const connection = await this.github.findInWorkspace(target.workspaceId, target.connectionId);
        if (!connection) return;
        // Each connection handles a delivery once (GitHub redelivers on failure).
        if (!(await this.github.claimDelivery(target.workspaceId, connection.id, delivery.deliveryId!))) return;
        handled = true;
        if (pr) await this.webhooks.applyPullRequest(connection, pr, 'pull_request');
        if (issue) await this.sync.applyIssue(connection, issue);
      });
    }
    return handled ? 'ok' : 'duplicate';
  }
}
