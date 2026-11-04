import type { AutomationAction, AutomationTrigger } from './automation.js';
import { flowActions, flowSteps, type AutomationFlow, type FlowCondition, type FlowStep } from './automation-flow.js';

/**
 * Automations inside a project template (B5). A template can't hold the ids of
 * one workspace's statuses or lists, so they become placeholders: UUID-shaped
 * (the normal validators accept them) and pointing at an index in the
 * template's `statuses` or `lists`. Steps that name people, channels or
 * webhooks don't travel and are left out.
 */
export interface TemplateAutomation {
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  flow: AutomationFlow;
}

type PlaceholderKind = 'status' | 'list';
const PREFIX: Record<PlaceholderKind, string> = { status: '00000000-0000-4000-8000-', list: '00000000-0000-4000-9000-' };

export function placeholderId(kind: PlaceholderKind, index: number): string {
  return `${PREFIX[kind]}${String(index).padStart(12, '0')}`;
}

/** The index a placeholder points at, or null when `id` isn't a placeholder of that kind. */
export function placeholderIndex(kind: PlaceholderKind, id: string): number | null {
  if (!id.startsWith(PREFIX[kind])) return null;
  const tail = id.slice(PREFIX[kind].length);
  return /^\d{12}$/.test(tail) ? Number(tail) : null;
}

interface IdMap {
  status: (id: string) => string | null;
  list: (id: string) => string | null;
}

/** Swaps every status and list id; null when one can't be mapped. */
function mapIds(trigger: AutomationTrigger, flow: AutomationFlow, map: IdMap): { trigger: AutomationTrigger; flow: AutomationFlow } | null {
  let ok = true;
  const status = (id: string) => map.status(id) ?? ((ok = false), id);
  const list = (id: string) => map.list(id) ?? ((ok = false), id);
  const condition = (value: FlowCondition): FlowCondition =>
    value.field === 'status' ? { ...value, statusIds: value.statusIds?.map(status) } : value.field === 'list' ? { ...value, listIds: value.listIds.map(list) } : value;
  const action = (value: AutomationAction): AutomationAction => (value.type === 'set_status' && value.statusId ? { ...value, statusId: status(value.statusId) } : value);
  const steps = (items: readonly FlowStep[]): FlowStep[] =>
    items.map((step) => (step.kind === 'action' ? { ...step, action: action(step.action) } : step.kind === 'if' ? { ...step, condition: condition(step.condition), yes: steps(step.yes), no: steps(step.no) } : step));
  const mapped = { trigger: { ...trigger, ...(trigger.statusIds ? { statusIds: trigger.statusIds.map(status) } : {}) }, flow: { steps: steps(flow.steps) } };
  return ok ? mapped : null;
}

/** Actions that point at things outside the project (people, channels, URLs). */
function travels(action: AutomationAction): AutomationAction | null {
  if (action.type === 'assign' || action.type === 'add_watcher' || action.type === 'post_chat' || action.type === 'webhook') return null;
  if (action.type === 'notify') return action.audiences?.length ? { ...action, userIds: [] } : null;
  return action;
}

function portableSteps(items: readonly FlowStep[]): FlowStep[] | null {
  const out: FlowStep[] = [];
  for (const step of items) {
    if (step.kind === 'action') {
      const action = travels(step.action);
      if (action) out.push({ ...step, action });
    } else if (step.kind === 'if') {
      // A condition about named people means something else elsewhere: the rule doesn't travel.
      if (step.condition.field === 'assignee' && step.condition.match === 'people') return null;
      const yes = portableSteps(step.yes);
      const no = portableSteps(step.no);
      if (!yes || !no) return null;
      out.push({ ...step, yes, no });
    } else {
      out.push(step);
    }
  }
  return out;
}

/**
 * A rule as a template entry: ids become placeholders, steps naming people,
 * channels or webhooks are dropped. Null when nothing useful is left.
 */
export function toTemplateAutomation(
  rule: { name: string; enabled: boolean; trigger: AutomationTrigger; flow: AutomationFlow },
  index: { status: (id: string) => number | undefined; list: (id: string) => number | undefined },
): TemplateAutomation | null {
  const steps = portableSteps(rule.flow.steps);
  if (!steps || flowActions({ steps }).length === 0) return null;
  const toPlaceholder = (kind: PlaceholderKind) => (id: string) => {
    const at = index[kind](id);
    return at === undefined ? null : placeholderId(kind, at);
  };
  const mapped = mapIds(rule.trigger, { steps }, { status: toPlaceholder('status'), list: toPlaceholder('list') });
  return mapped ? { name: rule.name, enabled: rule.enabled, ...mapped } : null;
}

/** A template entry bound to a new project's real status and list ids; null if a placeholder points nowhere. */
export function fromTemplateAutomation(automation: TemplateAutomation, ids: { statuses: readonly string[]; lists: readonly string[] }): { trigger: AutomationTrigger; flow: AutomationFlow } | null {
  const fromPlaceholder = (kind: PlaceholderKind, all: readonly string[]) => (id: string) => {
    const at = placeholderIndex(kind, id);
    return at === null ? null : (all[at] ?? null);
  };
  return mapIds(automation.trigger, automation.flow, { status: fromPlaceholder('status', ids.statuses), list: fromPlaceholder('list', ids.lists) });
}

/** Whether a template entry names anything that isn't a placeholder (people, channels, URLs). */
export function templateAutomationLeaks(automation: TemplateAutomation): boolean {
  return flowSteps(automation.flow.steps).some(
    (step) =>
      (step.kind === 'action' && travels(step.action) === null) ||
      (step.kind === 'action' && step.action.type === 'notify' && (step.action.userIds?.length ?? 0) > 0) ||
      (step.kind === 'if' && step.condition.field === 'assignee' && step.condition.match === 'people'),
  );
}
