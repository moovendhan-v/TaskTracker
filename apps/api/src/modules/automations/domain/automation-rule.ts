import type { AutomationAction, AutomationConditions, AutomationRunStatus, AutomationTrigger } from '@taskflow/shared-types';

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
  /** The person the rule acts as. Null once they are gone, which stops the rule. */
  createdById: string | null;
  runCount: number;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewAutomationRule = Pick<AutomationRule, 'workspaceId' | 'spaceId' | 'name' | 'enabled' | 'triggerType' | 'trigger' | 'conditions' | 'actions' | 'createdById'>;

export interface AutomationRun {
  id: string;
  workspaceId: string;
  ruleId: string;
  taskId: string | null;
  status: AutomationRunStatus;
  message: string;
  createdAt: Date;
}

export type NewAutomationRun = Omit<AutomationRun, 'id' | 'createdAt'>;
