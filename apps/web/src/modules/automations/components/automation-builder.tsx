import { FlaskConicalIcon, GitBranchIcon, LayoutTemplateIcon, Undo2Icon, ZapIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  AUTOMATION_LIMITS,
  AUTOMATION_TRIGGERS,
  FLOW_LIMITS,
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  flowActions,
  describeWait,
  flowFromRule,
  isScheduledTrigger,
  isSprintTrigger,
  type AutomationAction,
  type AutomationFlow,
  type AutomationRuleResponse,
  type AutomationTrigger,
  type AutomationTriggerType,
  type FlowStep,
  type FlowTraceOutcome,
  type SaveAutomationRequest,
} from '@taskflow/shared-types';
import { Modal } from '@/components/kit/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { useLists } from '@/modules/lists';
import { useMembers } from '@/modules/members';
import { useChatChannels } from '@/modules/chat';
import { useStatuses, useTaskSearch } from '@/modules/tasks';
import { automationsApi } from '../api/automations.api';
import { AUTOMATION_TEMPLATES } from '../lib/templates';
import { CATEGORY_LABELS, describeAction, describeCondition, describeFlow, PRIORITY_LABELS, TRIGGER_LABELS } from '../lib/describe-rule';
import { findStep, insertStep, newStepId, removeStep, replaceStep, type FlowSlot } from '../lib/flow-edit';
import { ActionFields, Chips, ConditionFields, defaultSchedule, Field, ScheduleFields, type Choices } from './fields';
import { FlowCanvas } from './flow-canvas';

interface AutomationBuilderProps {
  workspaceId: string;
  spaceId: string;
  rule: AutomationRuleResponse | null;
  onClose: () => void;
  onSave: (body: SaveAutomationRequest) => Promise<unknown>;
  /** Show this run's path on the flow (from run history). */
  path?: ReadonlyMap<string, FlowTraceOutcome>;
}

const STARTER: AutomationFlow = { steps: [{ id: 'action-1', kind: 'action', action: { type: 'notify', audiences: ['assignee'], message: '{{task}} moved to {{status}}' } }] };

/**
 * Build an automation as a flow: "When" on the left, the steps in the middle (if / else
 * branches, actions, stop), and the selected step's settings on the right. Older rules
 * open as the same flow. Undo (⌘Z) steps back through edits.
 */
export function AutomationBuilder({ workspaceId, spaceId, rule, onClose, onSave, path }: AutomationBuilderProps) {
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId);
  const { data: lists = [] } = useLists(workspaceId);
  const { data: members = [] } = useMembers(workspaceId);
  const { data: channelList = [] } = useChatChannels(workspaceId);
  // Channels the rule could post in as you: ones you're in, or public ones. Never DMs.
  const channels = channelList.filter((channel) => channel.kind !== 'dm' && !channel.archived && (channel.myRole || channel.kind === 'public')).map((channel) => ({ id: channel.id, name: channel.name ?? '' }));
  const choices: Choices = { statuses, lists: lists.filter((list) => list.spaceId === spaceId), members, channels };
  const [testPath, setTestPath] = useState<{ label: string; path: Map<string, FlowTraceOutcome> } | null>(null);

  const [name, setName] = useState(rule?.name ?? '');
  const [trigger, setTrigger] = useState<AutomationTrigger>(rule?.trigger ?? { type: 'task_created' });
  const [flow, setFlowState] = useState<AutomationFlow>(() => rule?.flow ?? (rule ? flowFromRule(rule.conditions, rule.actions) : STARTER));
  const [history, setHistory] = useState<AutomationFlow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(flow.steps[0]?.id ?? null);
  const [saving, setSaving] = useState(false);

  const names = {
    status: (id: string) => statuses.find((status) => status.id === id)?.name ?? 'a status',
    list: (id: string) => choices.lists.find((list) => list.id === id)?.name ?? 'a list',
    person: (id: string) => members.find((member) => member.userId === id)?.name ?? 'someone',
    channel: (id: string) => channels.find((channel) => channel.id === id)?.name ?? 'a channel',
  };
  const describe = (step: FlowStep) =>
    step.kind === 'action' ? sentenceCase(describeAction(step.action, names)) : step.kind === 'if' ? sentenceCase(describeCondition(step.condition, names)) : step.kind === 'wait' ? `Wait ${describeWait(step.minutes)}` : 'Stop here';
  const sentence = describeFlow(trigger, flow, names);
  const selected = findStep(flow.steps, selectedId);

  const setFlow = (next: AutomationFlow) => {
    setHistory((current) => [...current.slice(-29), flow]);
    setFlowState(next);
    setTestPath(null);
  };
  const useTemplate = (id: string) => {
    const template = AUTOMATION_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    setTrigger(template.trigger);
    setFlow(template.flow);
    if (!name.trim()) setName(template.name);
    setSelectedId(template.flow.steps[0]?.id ?? null);
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setFlowState(previous);
  };
  const insert = (slot: FlowSlot, kind: FlowStep['kind']) => {
    const id = newStepId(flow.steps, kind);
    const step: FlowStep =
      kind === 'action'
        ? { id, kind, action: { type: 'set_priority', priority: 'high' } }
        : kind === 'if'
          ? { id, kind, condition: { field: 'priority', priorities: ['urgent'] }, yes: [], no: [] }
          : kind === 'wait'
            ? { id, kind, minutes: 1440 }
            : { id, kind };
    setFlow({ steps: insertStep(flow.steps, slot, step) });
    setSelectedId(id);
  };
  const remove = (id: string) => {
    setFlow({ steps: removeStep(flow.steps, id) });
    if (selectedId === id) setSelectedId(null);
  };
  const update = (step: FlowStep) => setFlow({ steps: replaceStep(flow.steps, step) });

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || sentence.slice(0, AUTOMATION_LIMITS.nameMax), enabled: rule?.enabled ?? true, trigger, conditions: {}, actions: flowActions(flow), flow });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      tall
      title={rule ? 'Edit automation' : 'New automation'}
      eyebrow={<ZapIcon className="size-3.5 text-primary" />}
      headerActions={<Input value={name} maxLength={AUTOMATION_LIMITS.nameMax} onChange={(event) => setName(event.target.value)} placeholder="Name this automation…" aria-label="Automation name" className="h-8 w-72" />}
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm" aria-live="polite">
            <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">Reads as</span>
            {sentence}
          </p>
          <Button variant="outline" size="sm" disabled={history.length === 0} onClick={undo}>
            <Undo2Icon /> Undo
          </Button>
          <TestRun workspaceId={workspaceId} spaceId={spaceId} body={{ name: name || 'Test', trigger, conditions: {}, actions: flowActions(flow), flow }} onResult={setTestPath} />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || flowActions(flow).length === 0} onClick={() => void save()}>
            {rule ? 'Save automation' : 'Create automation'}
          </Button>
        </div>
      }
    >
      <div
        className="grid gap-5 p-5 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
            event.preventDefault();
            undo();
          }
        }}
      >
        <section className="grid content-start gap-3" aria-label="When">
          <StepLabel step="1" title="When" hint="What starts it" />
          {!rule ? (
            <Select value="" onValueChange={useTemplate}>
              <SelectTrigger aria-label="Start from a template" className="bg-card">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <LayoutTemplateIcon className="size-4" /> Start from a template…
                </span>
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <span className="grid">
                      <span>{template.name}</span>
                      <span className="text-xs text-muted-foreground">{template.description}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Card>
            <Select
              value={trigger.type}
              onValueChange={(type: AutomationTriggerType) => setTrigger(type === 'task_due_soon' ? { type, days: 1 } : type === 'on_schedule' ? { type, schedule: defaultSchedule() } : { type })}
            >
              <SelectTrigger aria-label="Trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_TRIGGERS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TRIGGER_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {trigger.type === 'task_status_changed' ? (
              <>
                <Field label="To these statuses (any when none picked)">
                  <Chips
                    options={statuses.map((status) => ({ value: status.id, label: status.name, color: status.color }))}
                    value={trigger.statusIds ?? []}
                    onChange={(statusIds) => setTrigger({ ...trigger, statusIds })}
                  />
                </Field>
                <Field label="Or into any status that means">
                  <Chips options={STATUS_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] }))} value={trigger.categories ?? []} onChange={(categories) => setTrigger({ ...trigger, categories })} />
                </Field>
              </>
            ) : null}
            {trigger.type === 'task_priority_changed' ? (
              <Field label="To these priorities (any when none picked)">
                <Chips options={TASK_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] }))} value={trigger.priorities ?? []} onChange={(priorities) => setTrigger({ ...trigger, priorities })} />
              </Field>
            ) : null}
            {trigger.type === 'task_due_soon' ? (
              <Field label="How far ahead (days, 0 = due today)">
                <Input
                  type="number"
                  min={0}
                  max={AUTOMATION_LIMITS.dueSoonDaysMax}
                  value={trigger.days ?? 1}
                  aria-label="Days ahead"
                  onChange={(event) => setTrigger({ ...trigger, days: Math.min(AUTOMATION_LIMITS.dueSoonDaysMax, Math.max(0, Math.round(Number(event.target.value) || 0))) })}
                  className="w-24"
                />
              </Field>
            ) : null}
            {trigger.type === 'on_schedule' ? <ScheduleFields schedule={trigger.schedule ?? defaultSchedule()} onChange={(schedule) => setTrigger({ ...trigger, schedule })} /> : null}
            {trigger.type === 'on_schedule' ? (
              <p className="text-xs text-muted-foreground">
                At that time, runs once for each open task in this project that matches (up to {AUTOMATION_LIMITS.tasksPerRun} a minute until all are done). Finished and cancelled tasks are left alone. Saved after today’s time? It starts on the next run day.
              </p>
            ) : isScheduledTrigger(trigger.type) ? (
              <p className="text-xs text-muted-foreground">Checked every minute. Fires once per open task and due date; finished and cancelled tasks are left alone.</p>
            ) : null}
            {isSprintTrigger(trigger.type) ? (
              <p className="text-xs text-muted-foreground">
                Runs once for each task in the sprint (up to {AUTOMATION_LIMITS.tasksPerRun}):{' '}
                {trigger.type === 'sprint_started' ? 'the tasks planned in when it starts.' : 'the tasks it held when it was completed, including unfinished ones that moved on.'} Use {'{{sprint}}'} for its name in messages.
              </p>
            ) : null}
            {trigger.type.startsWith('github_') ? <p className="text-xs text-muted-foreground">Needs a connected GitHub repository (workspace settings → Integrations). Pull requests link to tasks by number, like TF-42.</p> : null}
          </Card>
        </section>

        <section className="grid content-start gap-3" aria-label="Then">
          <StepLabel step="2" title="Then" hint="Runs as you, top to bottom; if a step fails, nothing sticks" />
          {testPath ? (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
              <FlaskConicalIcon className="size-3.5" /> Test run on {testPath.label}. The lit steps would run; nothing was changed.
              <button type="button" className="ml-auto underline" onClick={() => setTestPath(null)}>
                Clear
              </button>
            </p>
          ) : null}
          <div className="rounded-xl bg-muted/30 p-3">
            <FlowCanvas steps={flow.steps} selectedId={selectedId} describe={describe} onSelect={setSelectedId} onInsert={insert} onRemove={remove} path={testPath?.path ?? path} />
          </div>
        </section>

        <section className="grid content-start gap-3" aria-label="Step settings">
          <StepLabel step="3" title="Step" hint={selected ? 'Settings of the selected step' : 'Pick a step to change it'} />
          <Card>
            {!selected ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranchIcon className="size-4" /> Select a step, or use + to add one.
              </p>
            ) : selected.kind === 'action' ? (
              <ActionFields action={selected.action} onChange={(action: AutomationAction) => update({ ...selected, action })} choices={choices} />
            ) : selected.kind === 'if' ? (
              <>
                <ConditionFields condition={selected.condition} onChange={(condition) => update({ ...selected, condition })} choices={choices} />
                <p className="text-xs text-muted-foreground">Checked against the task as it is at that moment, after any earlier steps.</p>
              </>
            ) : selected.kind === 'wait' ? (
              <WaitFields minutes={selected.minutes} onChange={(minutes) => update({ ...selected, minutes })} />
            ) : (
              <p className="text-sm text-muted-foreground">The flow ends here; later steps in this branch don’t run.</p>
            )}
          </Card>
        </section>
      </div>
    </Modal>
  );
}

/** Pick a task of the project and see the path the flow would take for it. Nothing changes. */
function TestRun({ workspaceId, spaceId, body, onResult }: { workspaceId: string; spaceId: string; body: SaveAutomationRequest; onResult: (result: { label: string; path: Map<string, FlowTraceOutcome> }) => void }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  // Loaded once the picker opens; the most recently updated tasks first.
  const tasks = useTaskSearch(workspaceId, { spaceId }, { sort: [{ field: 'updatedAt', direction: 'desc' }] }, open);
  const run = async (taskId: string) => {
    const task = tasks.data?.items.find((item) => item.id === taskId);
    setRunning(true);
    try {
      const trace = await automationsApi.preview(workspaceId, spaceId, taskId, body);
      onResult({ label: task ? `#${task.number} ${task.title}` : 'the task', path: new Map(trace.map((entry) => [entry.stepId, entry.outcome as FlowTraceOutcome])) });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };
  // Always mounted, with no value of its own, so every pick (even the same task again) runs.
  return (
    <Select value="" open={open} onOpenChange={setOpen} onValueChange={(taskId) => void run(taskId)} disabled={running || flowActions(body.flow ?? { steps: [] }).length === 0}>
      <SelectTrigger aria-label="Test run" className="h-8 w-auto gap-1.5 bg-background px-3 text-sm font-medium [&>svg:last-child]:hidden">
        <FlaskConicalIcon className="size-4" /> {running ? 'Testing…' : 'Test run'}
      </SelectTrigger>
      <SelectContent>
        {tasks.isLoading ? <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading tasks…</p> : null}
        {tasks.data && tasks.data.items.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">No tasks in this project yet.</p> : null}
        {(tasks.data?.items ?? []).slice(0, 30).map((task) => (
          <SelectItem key={task.id} value={task.id}>
            #{task.number} {task.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const WAIT_UNITS = [
  { value: 1, label: 'minutes' },
  { value: 60, label: 'hours' },
  { value: 1440, label: 'days' },
] as const;

/** A wait as an amount and a unit; stored as minutes (5 minutes to 30 days). */
function WaitFields({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  const unit = minutes % 1440 === 0 ? 1440 : minutes % 60 === 0 ? 60 : 1;
  const clamp = (value: number) => Math.min(FLOW_LIMITS.waitMinutesMax, Math.max(FLOW_LIMITS.waitMinutesMin, Math.round(value)));
  return (
    <>
      <Field label="Wait for">
        <div className="flex gap-2">
          <Input type="number" min={1} value={minutes / unit} aria-label="Wait amount" onChange={(event) => onChange(clamp((Number(event.target.value) || 1) * unit))} className="w-24" />
          <Select value={String(unit)} onValueChange={(next) => onChange(clamp((minutes / unit) * Number(next)))}>
            <SelectTrigger aria-label="Wait unit" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WAIT_UNITS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Field>
      <p className="text-xs text-muted-foreground">
        What ran before the wait is kept. Then the steps after it run, looking at the task as it is by then. Editing the flow drops runs that are waiting. 5 minutes to 30 days.
      </p>
    </>
  );
}

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function StepLabel({ step, title, hint }: { step: string; title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{step}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 rounded-xl border bg-card p-4">{children}</div>;
}
