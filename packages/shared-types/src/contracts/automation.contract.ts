import type { AutomationAction, AutomationConditions, AutomationRunStatus, AutomationTrigger } from '../domain/automation.js';

export interface AutomationRuleResponse {
  id: string;
  spaceId: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  createdById: string | null;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface SaveAutomationRequest {
  name: string;
  enabled?: boolean;
  trigger: AutomationTrigger;
  conditions?: AutomationConditions;
  actions: AutomationAction[];
}

export interface AutomationRunResponse {
  id: string;
  ruleId: string;
  taskId: string | null;
  status: AutomationRunStatus;
  message: string;
  createdAt: string;
}
