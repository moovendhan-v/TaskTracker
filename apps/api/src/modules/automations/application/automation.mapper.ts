import type { AutomationRuleResponse, AutomationRunResponse } from '@taskflow/shared-types';
import type { AutomationRule, AutomationRun } from '../domain/automation-rule.js';

export const AutomationMapper = {
  toResponse(rule: AutomationRule): AutomationRuleResponse {
    return {
      id: rule.id,
      spaceId: rule.spaceId,
      name: rule.name,
      enabled: rule.enabled,
      trigger: rule.trigger,
      conditions: rule.conditions ?? {},
      actions: rule.actions,
      createdById: rule.createdById,
      runCount: rule.runCount,
      lastRunAt: rule.lastRunAt?.toISOString() ?? null,
      createdAt: rule.createdAt.toISOString(),
    };
  },

  toRunResponse(run: AutomationRun): AutomationRunResponse {
    return { id: run.id, ruleId: run.ruleId, taskId: run.taskId, status: run.status, message: run.message, createdAt: run.createdAt.toISOString() };
  },
};
