import type { AutomationAction, AutomationConditions, AutomationFlow, AutomationRunStatus, AutomationTrigger, FlowTraceEntry } from '@taskflow/shared-types';

export interface AutomationRule {
  id: string;
  workspaceId: string;
  spaceId: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTrigger['type'];
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  /** The steps as a tree; null for rules saved before flows (conditions and actions apply). */
  flow: AutomationFlow | null;
  /** The person the rule acts as. Null once they are gone, which stops the rule. */
  createdById: string | null;
  /** Signs webhook calls; sealed with the server key, never sent to clients except by an audited reveal. */
  webhookSecretSealed?: string | null;
  runCount: number;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewAutomationRule = Pick<AutomationRule, 'workspaceId' | 'spaceId' | 'name' | 'enabled' | 'triggerType' | 'trigger' | 'conditions' | 'actions' | 'flow' | 'createdById'>;

export interface AutomationRun {
  id: string;
  workspaceId: string;
  ruleId: string;
  taskId: string | null;
  status: AutomationRunStatus;
  message: string;
  trace: FlowTraceEntry[];
  /** For a waiting run: when it carries on. */
  resumesAt: Date | null;
  createdAt: Date;
}

export type NewAutomationRun = Omit<AutomationRun, 'id' | 'createdAt' | 'resumesAt'> & { resumesAt?: Date | null };

/** What a resumed run needs to know about the change that started it. */
export interface AutomationJobContext {
  actorId: string | null;
  pr?: string;
}

/** A run paused at a wait step. */
export interface AutomationJob {
  id: string;
  workspaceId: string;
  ruleId: string;
  taskId: string;
  runId: string | null;
  /** The wait step; the run carries on after it. */
  stepId: string;
  /** Fingerprint of the flow it paused in. */
  flowHash: string;
  context: AutomationJobContext;
  runAt: Date;
}

export type NewAutomationJob = Omit<AutomationJob, 'id'>;

/** A task a scheduled trigger may fire for. */
export interface DueTask {
  taskId: string;
  /** YYYY-MM-DD (UTC). */
  dueDate: string;
}

/** A webhook call waiting to be sent (or retried), with what's needed to sign it. */
export interface WebhookDeliveryJob {
  id: string;
  workspaceId: string;
  ruleId: string;
  runId: string | null;
  stepId: string;
  url: string;
  body: string;
  attempts: number;
  secretSealed: string | null;
}
