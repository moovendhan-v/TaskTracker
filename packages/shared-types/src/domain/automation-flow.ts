import type { AutomationAction, AutomationConditions } from './automation.js';
import { STATUS_CATEGORIES, TASK_PRIORITIES, TASK_TYPES, type StatusCategory, type TaskPriority, type TaskType } from './task.js';

/**
 * Automation flows (E1, docs/plan/E1_FLOWS.md): a small tree of steps run after
 * the trigger. A tree has no cycles or joins, so every flow ends and is easy to
 * draw and check. Rules without a flow are converted with `flowFromRule`.
 */
export type FlowStep = FlowActionStep | FlowIfStep | FlowStopStep | FlowWaitStep;

export interface FlowActionStep {
  id: string;
  kind: 'action';
  action: AutomationAction;
}

export interface FlowIfStep {
  id: string;
  kind: 'if';
  condition: FlowCondition;
  yes: FlowStep[];
  no: FlowStep[];
}

export interface FlowStopStep {
  id: string;
  kind: 'stop';
}

/**
 * Pauses the run, then carries on with the steps after it. What ran before the
 * wait is kept; the rest runs later with the task as it is then.
 */
export interface FlowWaitStep {
  id: string;
  kind: 'wait';
  minutes: number;
}

export type FlowCondition =
  | { field: 'status'; statusIds?: string[]; categories?: StatusCategory[] }
  | { field: 'priority'; priorities: TaskPriority[] }
  | { field: 'type'; types: TaskType[] }
  | { field: 'list'; listIds: string[] }
  | { field: 'assignee'; match: 'unassigned' | 'anyone' | 'people'; userIds?: string[] }
  | { field: 'due'; match: 'overdue' | 'within' | 'none'; days?: number }
  | { field: 'title'; contains: string };

export const FLOW_CONDITION_FIELDS = ['status', 'priority', 'type', 'list', 'assignee', 'due', 'title'] as const;

export interface AutomationFlow {
  steps: FlowStep[];
}

export const FLOW_LIMITS = {
  steps: 30,
  depth: 5,
  idsMax: 50,
  titleMax: 100,
  daysMax: 365,
  jsonMax: 32_768,
  /** A wait lasts 5 minutes to 30 days, and a flow has at most 5 of them. */
  waitMinutesMin: 5,
  waitMinutesMax: 43_200,
  waits: 5,
} as const;

const STEP_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isList = (value: unknown): value is unknown[] => Array.isArray(value);

function checkIds(values: unknown, what: string, problems: string[], pattern = UUID): void {
  if (values === undefined) return;
  if (!isList(values) || values.length > FLOW_LIMITS.idsMax || values.some((value) => typeof value !== 'string' || !pattern.test(value))) problems.push(`${what} must be a list of ids`);
}

function checkEnum(values: unknown, allowed: readonly string[], what: string, problems: string[], required = false): void {
  if (values === undefined && !required) return;
  if (!isList(values) || (required && values.length === 0) || values.some((value) => !allowed.includes(value as string))) problems.push(`${what}: pick from the list`);
}

function checkCondition(condition: FlowCondition, at: string, problems: string[]): void {
  switch (condition?.field) {
    case 'status':
      checkIds(condition.statusIds, `${at}: statuses`, problems);
      checkEnum(condition.categories, STATUS_CATEGORIES, `${at}: categories`, problems);
      if (!condition.statusIds?.length && !condition.categories?.length) problems.push(`${at}: pick a status or category`);
      return;
    case 'priority':
      return checkEnum(condition.priorities, TASK_PRIORITIES, `${at}: priorities`, problems, true);
    case 'type':
      return checkEnum(condition.types, TASK_TYPES, `${at}: types`, problems, true);
    case 'list':
      checkIds(condition.listIds, `${at}: lists`, problems);
      if (!condition.listIds?.length) problems.push(`${at}: pick a list`);
      return;
    case 'assignee':
      if (!['unassigned', 'anyone', 'people'].includes(condition.match)) problems.push(`${at}: unknown assignee match`);
      checkIds(condition.userIds, `${at}: people`, problems, /^[A-Za-z0-9_-]{1,64}$/);
      if (condition.match === 'people' && !condition.userIds?.length) problems.push(`${at}: pick people`);
      return;
    case 'due':
      if (!['overdue', 'within', 'none'].includes(condition.match)) problems.push(`${at}: unknown due match`);
      if (condition.match === 'within' && !(Number.isInteger(condition.days) && condition.days! >= 0 && condition.days! <= FLOW_LIMITS.daysMax)) problems.push(`${at}: days must be 0 to ${FLOW_LIMITS.daysMax}`);
      return;
    case 'title':
      if (typeof condition.contains !== 'string' || !condition.contains.trim() || condition.contains.length > FLOW_LIMITS.titleMax) problems.push(`${at}: text must be 1 to ${FLOW_LIMITS.titleMax} characters`);
      return;
    default:
      problems.push(`${at}: unknown condition`);
  }
}

/**
 * Problems with a flow's shape (empty when fine): step kinds, unique ids, size
 * and depth limits, and condition values. Actions are checked by the server's
 * action rules, the same ones flat rules use.
 */
export function validateFlowShape(flow: AutomationFlow): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  let count = 0;
  let waits = 0;
  const walk = (steps: unknown, depth: number, path: string) => {
    if (!isList(steps)) return void problems.push(`${path}: steps must be a list`);
    // depth counts the if-steps around this list, plus one.
    if (depth > FLOW_LIMITS.depth + 1) return void problems.push(`Conditions can nest at most ${FLOW_LIMITS.depth} deep`);
    steps.forEach((raw, index) => {
      const step = raw as FlowStep;
      const at = `${path} step ${index + 1}`;
      count += 1;
      if (!step || typeof step !== 'object' || typeof step.id !== 'string' || !STEP_ID.test(step.id)) return void problems.push(`${at}: invalid id`);
      if (ids.has(step.id)) problems.push(`${at}: duplicate id`);
      ids.add(step.id);
      if (step.kind === 'action') {
        if (!step.action || typeof step.action !== 'object' || typeof step.action.type !== 'string') problems.push(`${at}: missing action`);
      } else if (step.kind === 'if') {
        checkCondition(step.condition, at, problems);
        walk(step.yes, depth + 1, `${at} yes`);
        walk(step.no, depth + 1, `${at} no`);
      } else if (step.kind === 'wait') {
        waits += 1;
        if (!Number.isInteger(step.minutes) || step.minutes < FLOW_LIMITS.waitMinutesMin || step.minutes > FLOW_LIMITS.waitMinutesMax) {
          problems.push(`${at}: a wait lasts ${FLOW_LIMITS.waitMinutesMin} minutes to ${FLOW_LIMITS.waitMinutesMax / 1440} days`);
        }
      } else if (step.kind !== 'stop') {
        problems.push(`${at}: unknown step`);
      }
    });
  };
  if (!flow || typeof flow !== 'object') return ['A flow must be an object'];
  walk(flow.steps, 1, 'Flow');
  if (count > FLOW_LIMITS.steps) problems.push(`A flow can have at most ${FLOW_LIMITS.steps} steps`);
  if (waits > FLOW_LIMITS.waits) problems.push(`A flow can have at most ${FLOW_LIMITS.waits} waits`);
  if (count === 0) problems.push('Add at least one step');
  return [...new Set(problems)];
}

/** Every step, depth first. */
export function flowSteps(steps: readonly FlowStep[]): FlowStep[] {
  return steps.flatMap((step) => (step.kind === 'if' ? [step, ...flowSteps(step.yes), ...flowSteps(step.no)] : [step]));
}

/**
 * The steps that run after `stepId`, in order: the rest of its own list, then
 * the rest of each list around it, inner first. Null when the step isn't there.
 * A wait resumes with these.
 */
export function continuationAfter(steps: readonly FlowStep[], stepId: string): FlowStep[] | null {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const rest = steps.slice(index + 1);
    if (step.id === stepId) return rest;
    if (step.kind === 'if') {
      const inner = continuationAfter(step.yes, stepId) ?? continuationAfter(step.no, stepId);
      if (inner) return [...inner, ...rest];
    }
  }
  return null;
}

/** "2 days", "3 hours", "90 minutes": the largest whole unit. */
export function describeWait(minutes: number): string {
  const [amount, unit] = minutes % 1440 === 0 ? [minutes / 1440, 'day'] : minutes % 60 === 0 ? [minutes / 60, 'hour'] : [minutes, 'minute'];
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

export function flowActions(flow: AutomationFlow): AutomationAction[] {
  return flowSteps(flow.steps).flatMap((step) => (step.kind === 'action' ? [step.action] : []));
}

/** A flat rule as a flow: each set condition becomes an if-step, the actions run in the innermost yes branch. */
export function flowFromRule(conditions: AutomationConditions, actions: readonly AutomationAction[]): AutomationFlow {
  const run: FlowStep[] = actions.map((action, index) => ({ id: `action-${index + 1}`, kind: 'action', action }));
  const checks: FlowCondition[] = [
    ...(conditions.listIds?.length ? [{ field: 'list' as const, listIds: conditions.listIds }] : []),
    ...(conditions.priorities?.length ? [{ field: 'priority' as const, priorities: conditions.priorities }] : []),
    ...(conditions.types?.length ? [{ field: 'type' as const, types: conditions.types }] : []),
  ];
  const steps = checks.reduceRight<FlowStep[]>((inner, condition, index) => [{ id: `if-${index + 1}`, kind: 'if', condition, yes: inner, no: [] }], run);
  return { steps };
}

/** The task a condition looks at, as it is when the step runs. */
export interface FlowTaskFacts {
  listId: string;
  statusId: string;
  statusCategory: StatusCategory;
  priority: TaskPriority;
  type: TaskType;
  title: string;
  assigneeIds: readonly string[];
  /** YYYY-MM-DD, or null. */
  dueDate: string | null;
}

/** Whether a condition holds. `today` is YYYY-MM-DD in the workspace's view of today. */
export function evaluateCondition(condition: FlowCondition, task: FlowTaskFacts, today: string): boolean {
  switch (condition.field) {
    case 'status':
      return (condition.statusIds?.includes(task.statusId) ?? false) || (condition.categories?.includes(task.statusCategory) ?? false);
    case 'priority':
      return condition.priorities.includes(task.priority);
    case 'type':
      return condition.types.includes(task.type);
    case 'list':
      return condition.listIds.includes(task.listId);
    case 'assignee':
      if (condition.match === 'unassigned') return task.assigneeIds.length === 0;
      if (condition.match === 'anyone') return task.assigneeIds.length > 0;
      return task.assigneeIds.some((id) => condition.userIds?.includes(id));
    case 'due': {
      if (condition.match === 'none') return task.dueDate === null;
      if (!task.dueDate) return false;
      if (condition.match === 'overdue') return task.dueDate < today && task.statusCategory !== 'done' && task.statusCategory !== 'cancelled';
      return task.dueDate >= today && task.dueDate <= addDays(today, condition.days ?? 0);
    }
    case 'title':
      return task.title.toLowerCase().includes(condition.contains.trim().toLowerCase());
  }
}

/** YYYY-MM-DD plus whole days (UTC arithmetic on a calendar date). */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export const FLOW_TRACE_OUTCOMES = ['ran', 'took-yes', 'took-no', 'stopped', 'failed', 'waited'] as const;

/** A step's effect on the task, as far as later if-steps can see it (for test runs). */
export interface SimulatedEffects {
  /** set_status: the status's category, so "status category is …" conditions can follow. */
  statusCategoryOf: (statusId: string) => FlowTaskFacts['statusCategory'] | undefined;
}

/**
 * A test run: walks the flow against a task without changing anything. Actions
 * that change what a later condition reads (status, priority, assignee, due
 * date) are applied to a copy of the facts, so the path matches a real run.
 * Waits are passed straight through; a real run would pause there.
 */
export function simulateFlow(flow: AutomationFlow, task: FlowTaskFacts, today: string, effects: SimulatedEffects): FlowTraceEntry[] {
  const facts: FlowTaskFacts = { ...task, assigneeIds: [...task.assigneeIds] };
  const trace: FlowTraceEntry[] = [];
  const walk = (steps: readonly FlowStep[]): boolean => {
    for (const step of steps) {
      if (step.kind === 'stop') {
        trace.push({ stepId: step.id, outcome: 'stopped', detail: '' });
        return false;
      }
      if (step.kind === 'wait') {
        trace.push({ stepId: step.id, outcome: 'waited', detail: `would wait ${describeWait(step.minutes)}` });
        continue;
      }
      if (step.kind === 'if') {
        const holds = evaluateCondition(step.condition, facts, today);
        trace.push({ stepId: step.id, outcome: holds ? 'took-yes' : 'took-no', detail: '' });
        if (!walk(holds ? step.yes : step.no)) return false;
        continue;
      }
      const action = step.action;
      if (action.type === 'set_status' && action.statusId) {
        facts.statusId = action.statusId;
        facts.statusCategory = effects.statusCategoryOf(action.statusId) ?? facts.statusCategory;
      }
      if (action.type === 'set_priority' && action.priority) facts.priority = action.priority;
      if (action.type === 'move_to_list' && action.listId) facts.listId = action.listId;
      if (action.type === 'assign' && action.userId) facts.assigneeIds = [action.userId];
      if (action.type === 'unassign') facts.assigneeIds = [];
      if (action.type === 'set_due_date') facts.dueDate = action.days === null || action.days === undefined ? null : addDays(today, action.days);
      trace.push({ stepId: step.id, outcome: 'ran', detail: 'would run' });
    }
    return true;
  };
  walk(flow.steps);
  return trace;
}
export type FlowTraceOutcome = (typeof FLOW_TRACE_OUTCOMES)[number];

/** One step a run reached, in order. Details are our own short text, never task content. */
export interface FlowTraceEntry {
  stepId: string;
  outcome: FlowTraceOutcome;
  detail: string;
}
