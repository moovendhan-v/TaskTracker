import { GitBranchIcon, Undo2Icon, ZapIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  AUTOMATION_LIMITS,
  AUTOMATION_TRIGGERS,
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  flowActions,
  flowFromRule,
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
import { useStatuses } from '@/modules/tasks';
import { CATEGORY_LABELS, describeAction, describeCondition, describeFlow, PRIORITY_LABELS, TRIGGER_LABELS } from '../lib/describe-rule';
import { findStep, insertStep, newStepId, removeStep, replaceStep, type FlowSlot } from '../lib/flow-edit';
import { ActionFields, Chips, ConditionFields, Field, type Choices } from './fields';
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
  const choices: Choices = { statuses, lists: lists.filter((list) => list.spaceId === spaceId), members };

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
  };
  const describe = (step: FlowStep) => (step.kind === 'action' ? sentenceCase(describeAction(step.action, names)) : step.kind === 'if' ? sentenceCase(describeCondition(step.condition, names)) : 'Stop here');
  const sentence = describeFlow(trigger, flow, names);
  const selected = findStep(flow.steps, selectedId);

  const setFlow = (next: AutomationFlow) => {
    setHistory((current) => [...current.slice(-29), flow]);
    setFlowState(next);
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
          <Card>
            <Select value={trigger.type} onValueChange={(type: AutomationTriggerType) => setTrigger({ type })}>
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
            {trigger.type.startsWith('github_') ? <p className="text-xs text-muted-foreground">Needs a connected GitHub repository (workspace settings → Integrations). Pull requests link to tasks by number, like TF-42.</p> : null}
          </Card>
        </section>

        <section className="grid content-start gap-3" aria-label="Then">
          <StepLabel step="2" title="Then" hint="Runs as you, top to bottom; if a step fails, nothing sticks" />
          <div className="rounded-xl bg-muted/30 p-3">
            <FlowCanvas steps={flow.steps} selectedId={selectedId} describe={describe} onSelect={setSelectedId} onInsert={insert} onRemove={remove} path={path} />
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
            ) : (
              <p className="text-sm text-muted-foreground">The flow ends here; later steps in this branch don’t run.</p>
            )}
          </Card>
        </section>
      </div>
    </Modal>
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
