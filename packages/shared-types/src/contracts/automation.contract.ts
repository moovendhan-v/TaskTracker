import type { AutomationFlow, FlowTraceEntry } from '../domain/automation-flow.js';
import type { AutomationAction, AutomationConditions, AutomationRunStatus, AutomationTrigger } from '../domain/automation.js';

export interface AutomationRuleResponse {
  id: string;
  spaceId: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  /** The steps as a tree; null for a rule saved before flows (its conditions and actions apply). */
  flow: AutomationFlow | null;
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
  /** When set, the flow decides what runs; conditions and actions are ignored. */
  flow?: AutomationFlow | null;
}

export interface AutomationRunResponse {
  id: string;
  ruleId: string;
  taskId: string | null;
  status: AutomationRunStatus;
  message: string;
  /** The steps this run reached, in order. */
  trace: FlowTraceEntry[];
  /** A waiting run: when it carries on. */
  resumesAt: string | null;
  createdAt: string;
}
