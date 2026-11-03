import type { AutomationJob, AutomationRule, AutomationRun, DueTask, NewAutomationJob, NewAutomationRule, NewAutomationRun } from './automation-rule.js';

export abstract class AutomationRepository {
  abstract listInSpace(workspaceId: string, spaceId: string): Promise<AutomationRule[]>;
  abstract countInSpace(workspaceId: string, spaceId: string): Promise<number>;
  /** Enabled rules listening for any of these triggers. */
  abstract listEnabledFor(workspaceId: string, triggerTypes: readonly string[]): Promise<AutomationRule[]>;
  abstract findInWorkspace(workspaceId: string, ruleId: string): Promise<AutomationRule | null>;
  abstract create(rule: NewAutomationRule): Promise<AutomationRule>;
  abstract save(rule: AutomationRule): Promise<AutomationRule>;
  abstract delete(workspaceId: string, ruleId: string): Promise<void>;
  abstract markRun(workspaceId: string, ruleId: string, at: Date): Promise<void>;
  /**
   * Records a run and keeps only the newest ones per rule; returns its id. With
   * `runId`, updates that run instead (a waiting run carrying on), or records a
   * new one if it was already dropped.
   */
  abstract recordRun(run: NewAutomationRun, runId?: string | null): Promise<string>;
  abstract findRun(workspaceId: string, runId: string): Promise<AutomationRun | null>;

  // ── Time (E1 phase 2) ──
  abstract scheduleJob(job: NewAutomationJob): Promise<void>;
  /**
   * Due jobs of the workspace, locked for this transaction (FOR UPDATE SKIP LOCKED),
   * so two schedulers never resume the same run.
   */
  abstract claimDueJobs(workspaceId: string, now: Date, limit: number): Promise<AutomationJob[]>;
  abstract deleteJob(workspaceId: string, jobId: string): Promise<void>;
  /** Platform scope: workspaces with due jobs or enabled scheduled rules. */
  abstract workspacesToSweep(now: Date, scheduledTriggers: readonly string[], limit: number): Promise<string[]>;
  /** Open tasks of the space due from `from` to `to` (YYYY-MM-DD, inclusive), not yet fired for this rule. */
  abstract dueTasks(workspaceId: string, spaceId: string, ruleId: string, keyPrefix: string, from: string | null, to: string, limit: number): Promise<DueTask[]>;
  /** True when this is the first fire of the rule for this task and key. */
  abstract claimFire(workspaceId: string, ruleId: string, taskId: string, key: string): Promise<boolean>;
  /** Takes a transaction-level advisory lock; false when another scheduler holds it. */
  abstract tryLock(key: string): Promise<boolean>;

  abstract listRuns(workspaceId: string, ruleId: string, limit: number): Promise<AutomationRun[]>;
}
