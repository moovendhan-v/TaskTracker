import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { AutomationConditions } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { AutomationJob, AutomationRule, AutomationRun, DueTask, NewAutomationJob, NewAutomationRule, NewAutomationRun, WebhookDeliveryJob } from '../domain/automation-rule.js';
import { AutomationRepository } from '../domain/automation.repository.js';
import { AutomationJobOrmEntity, AutomationRuleOrmEntity, AutomationRunOrmEntity } from './automation.orm-entities.js';

/** Runs kept per rule; older ones are dropped as new ones arrive. */
const RUNS_KEPT = 100;

@Injectable()
export class TypeOrmAutomationRepository extends AutomationRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get rules() {
    return this.transactional.repository(AutomationRuleOrmEntity);
  }

  private get runs() {
    return this.transactional.repository(AutomationRunOrmEntity);
  }

  private get jobs() {
    return this.transactional.repository(AutomationJobOrmEntity);
  }

  listInSpace(workspaceId: string, spaceId: string): Promise<AutomationRule[]> {
    return this.rules.find({ where: { workspaceId, spaceId }, order: { createdAt: 'ASC' } });
  }

  countInSpace(workspaceId: string, spaceId: string): Promise<number> {
    return this.rules.countBy({ workspaceId, spaceId });
  }

  listEnabledFor(workspaceId: string, triggerTypes: readonly string[]): Promise<AutomationRule[]> {
    return this.rules.find({ where: { workspaceId, enabled: true, triggerType: In([...triggerTypes]) as never }, order: { createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, ruleId: string): Promise<AutomationRule | null> {
    return this.rules.findOneBy({ id: ruleId, workspaceId });
  }

  create(rule: NewAutomationRule): Promise<AutomationRule> {
    return this.rules.save(this.rules.create(rule));
  }

  save(rule: AutomationRule): Promise<AutomationRule> {
    return this.rules.save(this.rules.create(rule));
  }

  async delete(workspaceId: string, ruleId: string): Promise<void> {
    await this.rules.delete({ id: ruleId, workspaceId });
  }

  async markRun(workspaceId: string, ruleId: string, at: Date): Promise<void> {
    await this.rules.update({ id: ruleId, workspaceId }, { runCount: () => 'run_count + 1', lastRunAt: at } as never);
  }

  async recordRun(run: NewAutomationRun, runId?: string | null): Promise<string> {
    const values = { ...run, resumesAt: run.resumesAt ?? null };
    if (runId) {
      const result = await this.runs.update({ id: runId, workspaceId: run.workspaceId }, values as never);
      if (result.affected) return runId;
    }
    const inserted = await this.runs.insert(values);
    await this.transactional.manager.query(
      `DELETE FROM automation_run WHERE workspace_id = $1 AND rule_id = $2 AND id NOT IN (
         SELECT id FROM automation_run WHERE workspace_id = $1 AND rule_id = $2 ORDER BY created_at DESC LIMIT $3)`,
      [run.workspaceId, run.ruleId, RUNS_KEPT],
    );
    return (inserted.identifiers[0] as { id: string }).id;
  }

  findRun(workspaceId: string, runId: string): Promise<AutomationRun | null> {
    return this.runs.findOneBy({ id: runId, workspaceId });
  }

  async scheduleJob(job: NewAutomationJob): Promise<void> {
    await this.jobs.insert(job);
  }

  async claimDueJobs(workspaceId: string, now: Date, limit: number): Promise<AutomationJob[]> {
    const rows: { id: string }[] = await this.transactional.manager.query(
      `SELECT id FROM automation_job WHERE workspace_id = $1 AND run_at <= $2 ORDER BY run_at LIMIT $3 FOR UPDATE SKIP LOCKED`,
      [workspaceId, now, limit],
    );
    if (rows.length === 0) return [];
    return this.jobs.find({ where: { workspaceId, id: In(rows.map((row) => row.id)) }, order: { runAt: 'ASC' } });
  }

  async deleteJob(workspaceId: string, jobId: string): Promise<void> {
    await this.jobs.delete({ id: jobId, workspaceId });
  }

  async workspacesToSweep(now: Date, scheduledTriggers: readonly string[], limit: number): Promise<string[]> {
    const rows: { workspace_id: string }[] = await this.transactional.manager.query(
      `SELECT workspace_id FROM (
         SELECT workspace_id FROM automation_job WHERE run_at <= $1
         UNION
         SELECT workspace_id FROM automation_rule WHERE enabled AND trigger_type = ANY($2)
         UNION
         SELECT workspace_id FROM automation_webhook_delivery WHERE status = 'pending' AND next_attempt_at <= $1
       ) due LIMIT $3`,
      [now, [...scheduledTriggers], limit],
    );
    return rows.map((row) => row.workspace_id);
  }

  async dueTasks(workspaceId: string, spaceId: string, ruleId: string, keyPrefix: string, from: string | null, to: string, limit: number): Promise<DueTask[]> {
    const rows: { id: string; due: string }[] = await this.transactional.manager.query(
      `SELECT t.id, to_char((t.due_date AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS due
         FROM task t
         JOIN task_status s ON s.id = t.status_id
        WHERE t.workspace_id = $1 AND t.space_id = $2 AND t.due_date IS NOT NULL
          AND s.category NOT IN ('done', 'cancelled')
          AND ($3::date IS NULL OR (t.due_date AT TIME ZONE 'UTC')::date >= $3::date)
          AND (t.due_date AT TIME ZONE 'UTC')::date <= $4::date
          AND NOT EXISTS (
            SELECT 1 FROM automation_fire f
             WHERE f.rule_id = $5 AND f.task_id = t.id
               AND f.fire_key = $6 || to_char((t.due_date AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD'))
        ORDER BY t.due_date, t.id
        LIMIT $7`,
      [workspaceId, spaceId, from, to, ruleId, keyPrefix, limit],
    );
    return rows.map((row) => ({ taskId: row.id, dueDate: row.due }));
  }

  async openTasksToFire(workspaceId: string, spaceId: string, ruleId: string, key: string, conditions: AutomationConditions, limit: number): Promise<string[]> {
    const rows: { id: string }[] = await this.transactional.manager.query(
      `SELECT t.id FROM task t
         JOIN task_status s ON s.id = t.status_id
        WHERE t.workspace_id = $1 AND t.space_id = $2
          AND s.category NOT IN ('done', 'cancelled')
          AND (cardinality($5::uuid[]) = 0 OR t.list_id = ANY($5::uuid[]))
          AND (cardinality($6::text[]) = 0 OR t.priority = ANY($6::text[]))
          AND (cardinality($7::text[]) = 0 OR t.type = ANY($7::text[]))
          AND NOT EXISTS (SELECT 1 FROM automation_fire f WHERE f.rule_id = $3 AND f.task_id = t.id AND f.fire_key = $4)
        ORDER BY t.number
        LIMIT $8`,
      [workspaceId, spaceId, ruleId, key, conditions.listIds ?? [], conditions.priorities ?? [], conditions.types ?? [], limit],
    );
    return rows.map((row) => row.id);
  }

  async sprintTaskIds(workspaceId: string, sprintId: string, phase: 'start' | 'end', limit: number): Promise<string[]> {
    const rows: { id: string }[] =
      phase === 'start'
        ? await this.transactional.manager.query(`SELECT id FROM task WHERE workspace_id = $1 AND sprint_id = $2 ORDER BY number LIMIT $3`, [workspaceId, sprintId, limit])
        : await this.transactional.manager.query(
            `SELECT t.id FROM sprint_task_snapshot snap JOIN task t ON t.id = snap.task_id AND t.workspace_id = snap.workspace_id
              WHERE snap.workspace_id = $1 AND snap.sprint_id = $2 AND snap.phase = 'end' ORDER BY snap.number LIMIT $3`,
            [workspaceId, sprintId, limit],
          );
    return rows.map((row) => row.id);
  }

  async claimFire(workspaceId: string, ruleId: string, taskId: string, key: string): Promise<boolean> {
    const rows: unknown[] = await this.transactional.manager.query(
      `INSERT INTO automation_fire (workspace_id, rule_id, task_id, fire_key) VALUES ($1, $2, $3, $4)
       ON CONFLICT (rule_id, task_id, fire_key) DO NOTHING RETURNING id`,
      [workspaceId, ruleId, taskId, key],
    );
    return rows.length > 0;
  }

  async tryLock(key: string): Promise<boolean> {
    const [row] = (await this.transactional.manager.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`, [key])) as { locked: boolean }[];
    return row?.locked === true;
  }

  async queueWebhook(delivery: { workspaceId: string; ruleId: string; stepId: string; url: string; body: string }): Promise<string> {
    const [row] = (await this.transactional.manager.query(
      `INSERT INTO automation_webhook_delivery (workspace_id, rule_id, step_id, url, body) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [delivery.workspaceId, delivery.ruleId, delivery.stepId, delivery.url, delivery.body],
    )) as { id: string }[];
    return row!.id;
  }

  async attachWebhooks(workspaceId: string, deliveryIds: readonly string[], runId: string): Promise<void> {
    if (deliveryIds.length === 0) return;
    await this.transactional.manager.query(`UPDATE automation_webhook_delivery SET run_id = $3 WHERE workspace_id = $1 AND id = ANY($2::uuid[])`, [workspaceId, [...deliveryIds], runId]);
  }

  async leaseWebhooks(workspaceId: string, now: Date, leaseUntil: Date, limit: number): Promise<WebhookDeliveryJob[]> {
    const result: unknown = await this.transactional.manager.query(
      `UPDATE automation_webhook_delivery d SET attempts = d.attempts + 1, next_attempt_at = $3
         FROM automation_rule r
        WHERE r.id = d.rule_id AND r.workspace_id = d.workspace_id
          AND d.id IN (SELECT id FROM automation_webhook_delivery
                        WHERE workspace_id = $1 AND status = 'pending' AND next_attempt_at <= $2
                        ORDER BY next_attempt_at LIMIT $4 FOR UPDATE SKIP LOCKED)
        RETURNING d.id, d.workspace_id, d.rule_id, d.run_id, d.step_id, d.url, d.body, d.attempts, r.webhook_secret_sealed`,
      [workspaceId, now, leaseUntil, limit],
    );
    const rows = (Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row['id']),
      workspaceId: String(row['workspace_id']),
      ruleId: String(row['rule_id']),
      runId: (row['run_id'] as string | null) ?? null,
      stepId: String(row['step_id']),
      url: String(row['url']),
      body: String(row['body']),
      attempts: Number(row['attempts']),
      secretSealed: (row['webhook_secret_sealed'] as string | null) ?? null,
    }));
  }

  async finishWebhook(workspaceId: string, id: string, result: { status: 'pending' | 'sent' | 'failed'; nextAttemptAt: Date; detail: string }): Promise<void> {
    await this.transactional.manager.query(
      `UPDATE automation_webhook_delivery SET status = $3, next_attempt_at = $4, last_detail = $5 WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id, result.status, result.nextAttemptAt, result.detail.slice(0, 200)],
    );
  }

  async setTraceDetail(workspaceId: string, runId: string, stepId: string, detail: string): Promise<void> {
    await this.transactional.manager.query(
      `UPDATE automation_run SET trace = (
         SELECT coalesce(jsonb_agg(CASE WHEN entry->>'stepId' = $3 THEN jsonb_set(entry, '{detail}', to_jsonb($4::text)) ELSE entry END ORDER BY position), '[]'::jsonb)
           FROM jsonb_array_elements(trace) WITH ORDINALITY AS item(entry, position))
       WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, runId, stepId, detail.slice(0, 200)],
    );
  }

  async saveWebhookSecret(workspaceId: string, ruleId: string, sealed: string): Promise<void> {
    await this.rules.update({ id: ruleId, workspaceId }, { webhookSecretSealed: sealed } as never);
  }

  listRuns(workspaceId: string, ruleId: string, limit: number): Promise<AutomationRun[]> {
    return this.runs.find({ where: { workspaceId, ruleId }, order: { createdAt: 'DESC' }, take: limit });
  }
}
