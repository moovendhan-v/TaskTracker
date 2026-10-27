import type { AutomationRuleResponse, SaveAutomationRequest } from '@taskflow/shared-types';
import {
  AutomationRunsDocument,
  AutomationsDocument,
  CreateAutomationDocument,
  DeleteAutomationDocument,
  SetAutomationEnabledDocument,
  UpdateAutomationDocument,
  type AutomationRuleFieldsFragment,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Drops the nulls GraphQL sends for unused parts, so a rule can go straight back as input. */
export function toSaveRequest(rule: SaveAutomationRequest): SaveAutomationRequest {
  const clean = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && !(Array.isArray(item) && item.length === 0))) as T;
  return { name: rule.name, enabled: rule.enabled, trigger: clean(rule.trigger), conditions: clean(rule.conditions ?? {}), actions: rule.actions.map(clean) };
}

const toRule = (rule: AutomationRuleFieldsFragment): AutomationRuleResponse => rule as unknown as AutomationRuleResponse;

export const automationsApi = {
  list: async (workspaceId: string, spaceId: string) => (await graphql(AutomationsDocument, { workspaceId, spaceId })).automations.map(toRule),
  runs: async (workspaceId: string, ruleId: string) => (await graphql(AutomationRunsDocument, { workspaceId, ruleId })).automationRuns,
  create: async (workspaceId: string, spaceId: string, input: SaveAutomationRequest) => toRule((await graphql(CreateAutomationDocument, { workspaceId, spaceId, input })).createAutomation),
  update: async (workspaceId: string, ruleId: string, input: SaveAutomationRequest) => toRule((await graphql(UpdateAutomationDocument, { workspaceId, ruleId, input })).updateAutomation),
  setEnabled: async (workspaceId: string, ruleId: string, enabled: boolean) => toRule((await graphql(SetAutomationEnabledDocument, { workspaceId, ruleId, enabled })).setAutomationEnabled),
  remove: async (workspaceId: string, ruleId: string) => (await graphql(DeleteAutomationDocument, { workspaceId, ruleId })).deleteAutomation,
};
