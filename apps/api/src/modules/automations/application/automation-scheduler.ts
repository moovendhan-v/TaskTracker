import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { addDays, SCHEDULED_TRIGGERS, type ScheduledTriggerType } from '@taskflow/shared-types';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { SecretBox } from '../../../core/crypto/secret-box.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { deliverWebhook, parseAllowedHosts, type WebhookPolicy } from '../../../core/net/outbound-webhook.js';
import { Clock } from '../../../core/time/clock.port.js';
import type { AutomationRule, WebhookDeliveryJob } from '../domain/automation-rule.js';
import { AutomationRepository } from '../domain/automation.repository.js';
import { AutomationEngine } from './automation-engine.js';

/** Bounds on one tick, so a backlog drains over several ticks instead of one long transaction. */
const WORKSPACES_PER_TICK = 200;
const JOBS_PER_WORKSPACE = 50;
const TASKS_PER_RULE = 100;
const WEBHOOKS_PER_WORKSPACE = 20;
/** A leased delivery isn't picked up again for this long, even if this instance dies mid-send. */
const WEBHOOK_LEASE_MS = 2 * 60_000;
/** Waits before the 2nd and 3rd try; after the 3rd failure the delivery is given up. */
const WEBHOOK_RETRY_MS = [60_000, 5 * 60_000];
const WEBHOOK_TRIES = WEBHOOK_RETRY_MS.length + 1;

/** Fire keys: one fire per rule, task and due date. */
const KEY_PREFIX: Record<ScheduledTriggerType, string> = { task_due_soon: 'due-soon:', task_overdue: 'overdue:' };

/**
 * The clock side of automations (E1 phase 2). Every AUTOMATION_TICK_SECONDS it:
 *
 * - resumes runs whose wait is over;
 * - fires "due soon" and "overdue" rules, once per task and due date.
 *
 * Finding which workspaces have work is the only platform-scope read; all the
 * work then runs in that workspace's scope, one transaction per workspace.
 * Several API instances can run this at once: a per-workspace advisory lock
 * keeps them apart, jobs are claimed with SKIP LOCKED, and a unique fire key
 * makes a second fire a no-op.
 */
@Injectable()
export class AutomationScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AutomationScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly automations: AutomationRepository,
    private readonly engine: AutomationEngine,
    private readonly transactional: TransactionalManager,
    private readonly clock: Clock,
    private readonly secretBox: SecretBox,
  ) {}

  private webhookPolicy(): WebhookPolicy {
    return { allowedHosts: parseAllowedHosts(this.env.AUTOMATION_WEBHOOK_HOSTS), insecureForTests: this.env.AUTOMATION_WEBHOOK_INSECURE_FOR_TESTS };
  }

  onApplicationBootstrap(): void {
    if (this.env.AUTOMATION_TICK_SECONDS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.env.AUTOMATION_TICK_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One pass over every workspace with work. Never throws; failures are logged per workspace. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = this.clock.now();
      const workspaces = await this.transactional.runInScope({ kind: 'platform' }, () => this.automations.workspacesToSweep(now, SCHEDULED_TRIGGERS, WORKSPACES_PER_TICK));
      for (const workspaceId of workspaces) {
        try {
          const webhooks = await this.transactional.runInScope({ kind: 'workspace', workspaceId, userId: null }, () => this.sweep(workspaceId, now));
          // Sent after the sweep's transaction has committed, so no database lock waits on the network.
          for (const webhook of webhooks) await this.send(webhook);
        } catch (error) {
          this.logger.error(`Automation sweep failed for a workspace`, error instanceof Error ? error.stack : undefined);
        }
      }
    } catch (error) {
      this.logger.error('Automation scheduler tick failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.ticking = false;
    }
  }

  private async sweep(workspaceId: string, now: Date): Promise<WebhookDeliveryJob[]> {
    if (!(await this.automations.tryLock(`automation-sweep:${workspaceId}`))) return [];
    for (const job of await this.automations.claimDueJobs(workspaceId, now, JOBS_PER_WORKSPACE)) {
      await this.engine.resume(job);
      await this.automations.deleteJob(workspaceId, job.id);
    }
    const today = now.toISOString().slice(0, 10);
    for (const rule of await this.automations.listEnabledFor(workspaceId, SCHEDULED_TRIGGERS)) {
      await this.fire(rule, today);
    }
    return this.automations.leaseWebhooks(workspaceId, now, new Date(now.getTime() + WEBHOOK_LEASE_MS), WEBHOOKS_PER_WORKSPACE);
  }

  /** One try at a leased webhook, then its outcome (and the run's trace) in a short transaction of its own. */
  private async send(webhook: WebhookDeliveryJob): Promise<void> {
    let secret: string | null;
    try {
      secret = webhook.secretSealed ? this.secretBox.open(webhook.secretSealed) : null;
    } catch {
      secret = null;
    }
    const result = secret
      ? await deliverWebhook({ url: webhook.url, body: webhook.body, secret, deliveryId: webhook.id }, this.webhookPolicy(), this.clock.now())
      : { ok: false, status: null, detail: 'no signing secret: save the automation again' };
    const final = result.ok || webhook.attempts >= WEBHOOK_TRIES || !secret;
    const status = result.ok ? 'sent' : final ? 'failed' : 'pending';
    const nextAttemptAt = new Date(this.clock.now().getTime() + (final ? 0 : WEBHOOK_RETRY_MS[webhook.attempts - 1]!));
    const detail = result.ok ? `Sent (${result.detail})` : final ? `Failed after ${webhook.attempts} ${webhook.attempts === 1 ? 'try' : 'tries'}: ${result.detail}` : `Try ${webhook.attempts} failed (${result.detail}); trying again`;
    await this.transactional.runInScope({ kind: 'workspace', workspaceId: webhook.workspaceId, userId: null }, async () => {
      await this.automations.finishWebhook(webhook.workspaceId, webhook.id, { status, nextAttemptAt, detail });
      if (webhook.runId) await this.automations.setTraceDetail(webhook.workspaceId, webhook.runId, webhook.stepId, detail);
    });
  }

  private async fire(rule: AutomationRule, today: string): Promise<void> {
    const type = rule.triggerType as ScheduledTriggerType;
    const prefix = KEY_PREFIX[type];
    // Overdue: due before today. Due soon: due today up to N days ahead.
    const [from, to] = type === 'task_overdue' ? [null, addDays(today, -1)] : [today, addDays(today, rule.trigger.days ?? 1)];
    for (const due of await this.automations.dueTasks(rule.workspaceId, rule.spaceId, rule.id, prefix, from, to, TASKS_PER_RULE)) {
      if (await this.automations.claimFire(rule.workspaceId, rule.id, due.taskId, `${prefix}${due.dueDate}`)) await this.engine.runScheduled(rule, due.taskId);
    }
  }
}
