import type { AutomationRule, AutomationRun, NewAutomationRule, NewAutomationRun } from './automation-rule.js';

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
  /** Records a run and keeps only the newest ones per rule. */
  abstract recordRun(run: NewAutomationRun): Promise<void>;
  abstract listRuns(workspaceId: string, ruleId: string, limit: number): Promise<AutomationRun[]>;
}
