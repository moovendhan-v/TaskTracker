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
  createdAt: Date;
}

export type NewAutomationRun = Omit<AutomationRun, 'id' | 'createdAt'>;
