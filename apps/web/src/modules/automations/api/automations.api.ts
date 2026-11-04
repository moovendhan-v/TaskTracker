import type { AutomationFlow, AutomationRuleResponse, SaveAutomationRequest } from '@taskflow/shared-types';
import {
  AutomationRunsDocument,
  AutomationsDocument,
  CreateAutomationDocument,
  DeleteAutomationDocument,
  PreviewAutomationDocument,
  RevealAutomationWebhookSecretDocument,
  SetAutomationEnabledDocument,
  UpdateAutomationDocument,
  type AutomationRuleFieldsFragment,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Drops the nulls GraphQL sends for unused parts, so a rule can go straight back as input. */
export function toSaveRequest(rule: SaveAutomationRequest): SaveAutomationRequest {
  const clean = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && !(Array.isArray(item) && item.length === 0))) as T;
  return { name: rule.name, enabled: rule.enabled, trigger: clean(rule.trigger), conditions: clean(rule.conditions ?? {}), actions: rule.actions.map(clean), flow: rule.flow ?? null };
}

/** The flow travels as JSON text in GraphQL; here it becomes the tree again. */
const toRule = ({ flowJson, ...rule }: AutomationRuleFieldsFragment): AutomationRuleResponse =>
  ({ ...rule, flow: flowJson ? (JSON.parse(flowJson) as AutomationFlow) : null }) as unknown as AutomationRuleResponse;

const toInput = ({ flow, ...request }: SaveAutomationRequest) => ({ ...request, flowJson: flow ? JSON.stringify(flow) : null });

export const automationsApi = {
  list: async (workspaceId: string, spaceId: string) => (await graphql(AutomationsDocument, { workspaceId, spaceId })).automations.map(toRule),
  runs: async (workspaceId: string, ruleId: string) => (await graphql(AutomationRunsDocument, { workspaceId, ruleId })).automationRuns,
  create: async (workspaceId: string, spaceId: string, input: SaveAutomationRequest) => toRule((await graphql(CreateAutomationDocument, { workspaceId, spaceId, input: toInput(input) })).createAutomation),
  update: async (workspaceId: string, ruleId: string, input: SaveAutomationRequest) => toRule((await graphql(UpdateAutomationDocument, { workspaceId, ruleId, input: toInput(input) })).updateAutomation),
  setEnabled: async (workspaceId: string, ruleId: string, enabled: boolean) => toRule((await graphql(SetAutomationEnabledDocument, { workspaceId, ruleId, enabled })).setAutomationEnabled),
  remove: async (workspaceId: string, ruleId: string) => (await graphql(DeleteAutomationDocument, { workspaceId, ruleId })).deleteAutomation,
  /** A test run: the path the flow would take for one task. Changes nothing. */
  preview: async (workspaceId: string, spaceId: string, taskId: string, input: SaveAutomationRequest) =>
    (await graphql(PreviewAutomationDocument, { workspaceId, spaceId, taskId, input: toInput(toSaveRequest(input)) })).previewAutomation,
  /** The webhook signing secret (audited on the server). */
  revealSecret: async (workspaceId: string, ruleId: string, rotate: boolean) => (await graphql(RevealAutomationWebhookSecretDocument, { workspaceId, ruleId, rotate })).revealAutomationWebhookSecret,
};
