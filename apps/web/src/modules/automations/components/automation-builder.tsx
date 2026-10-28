import { ArrowDownIcon, PlusIcon, TrashIcon, ZapIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_LIMITS,
  AUTOMATION_TRIGGERS,
  NOTIFY_AUDIENCES,
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  TASK_TYPES,
  type AutomationAction,
  type AutomationConditions,
  type AutomationRuleResponse,
  type AutomationTrigger,
  type AutomationTriggerType,
  type SaveAutomationRequest,
} from '@taskflow/shared-types';
import { Modal } from '@/components/kit/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/errors';
import { useLists } from '@/modules/lists';
import { useMembers } from '@/modules/members';
import { useStatuses } from '@/modules/tasks';
import { ACTION_LABELS, AUDIENCE_LABELS, CATEGORY_LABELS, describeRule, PRIORITY_LABELS, TRIGGER_LABELS } from '../lib/describe-rule';

interface AutomationBuilderProps {
  workspaceId: string;
  spaceId: string;
  rule: AutomationRuleResponse | null;
  onClose: () => void;
  onSave: (body: SaveAutomationRequest) => Promise<unknown>;
}

/** Build a rule in two halves, "when" on the left and "then" on the right, with the whole rule read back as a sentence. */
export function AutomationBuilder({ workspaceId, spaceId, rule, onClose, onSave }: AutomationBuilderProps) {
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId);
  const { data: lists = [] } = useLists(workspaceId);
  const { data: members = [] } = useMembers(workspaceId);
  const spaceLists = lists.filter((list) => list.spaceId === spaceId);

  const [name, setName] = useState(rule?.name ?? '');
  const [trigger, setTrigger] = useState<AutomationTrigger>(rule?.trigger ?? { type: 'task_created' });
  const [conditions, setConditions] = useState<AutomationConditions>(rule?.conditions ?? {});
  const [actions, setActions] = useState<AutomationAction[]>(rule?.actions ?? [{ type: 'notify', audiences: ['assignee'], message: '{{task}} moved to {{status}}' }]);
  const [saving, setSaving] = useState(false);

  const names = {
    status: (id: string) => statuses.find((status) => status.id === id)?.name ?? 'a status',
    list: (id: string) => spaceLists.find((list) => list.id === id)?.name ?? 'a list',
    person: (id: string) => members.find((member) => member.userId === id)?.name ?? 'someone',
  };
  const sentence = describeRule({ trigger, conditions, actions }, names);
  const setAction = (index: number, next: AutomationAction) => setActions((current) => current.map((action, at) => (at === index ? next : action)));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || sentence.slice(0, AUTOMATION_LIMITS.nameMax), enabled: rule?.enabled ?? true, trigger, conditions, actions });
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || actions.length === 0} onClick={() => void save()}>
            {rule ? 'Save automation' : 'Create automation'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 p-5 lg:grid-cols-2">
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

          <StepLabel step="2" title="Only for" hint="Optional filters; every one you set must match" />
          <Card>
            <Field label="Sources: lists in this project (all when none picked)">
              <Chips options={spaceLists.map((list) => ({ value: list.id, label: list.name }))} value={conditions.listIds ?? []} onChange={(listIds) => setConditions({ ...conditions, listIds })} />
            </Field>
            <Field label="Task types">
              <Chips options={TASK_TYPES.map((type) => ({ value: type, label: type }))} value={conditions.types ?? []} onChange={(types) => setConditions({ ...conditions, types })} />
            </Field>
            <Field label="Priorities">
              <Chips options={TASK_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] }))} value={conditions.priorities ?? []} onChange={(priorities) => setConditions({ ...conditions, priorities })} />
            </Field>
          </Card>
        </section>

        <section className="grid content-start gap-3" aria-label="Then">
          <StepLabel step="3" title="Then" hint="Done in order, as you; if one fails, none of them stick" />
          {actions.map((action, index) => (
            <div key={index} className="grid gap-3">
              {index > 0 ? <ArrowDownIcon className="mx-auto size-4 text-muted-foreground" aria-hidden /> : null}
              <Card>
                <div className="flex items-center gap-2">
                  <Select value={action.type} onValueChange={(type: AutomationAction['type']) => setAction(index, type === 'notify' ? { type, audiences: ['assignee'], message: '' } : { type })}>
                    <SelectTrigger aria-label={`Action ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_ACTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ACTION_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove action ${index + 1}`} disabled={actions.length === 1} onClick={() => setActions(actions.filter((_, at) => at !== index))}>
                    <TrashIcon />
                  </Button>
                </div>
                {action.type === 'set_status' ? (
                  <Select value={action.statusId ?? ''} onValueChange={(statusId) => setAction(index, { ...action, statusId })}>
                    <SelectTrigger aria-label="Status to set">
                      <SelectValue placeholder="Pick a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {action.type === 'set_priority' ? (
                  <Select value={action.priority ?? ''} onValueChange={(priority: (typeof TASK_PRIORITIES)[number]) => setAction(index, { ...action, priority })}>
                    <SelectTrigger aria-label="Priority to set">
                      <SelectValue placeholder="Pick a priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {action.type === 'assign' ? (
                  <Select value={action.userId ?? ''} onValueChange={(userId) => setAction(index, { ...action, userId })}>
                    <SelectTrigger aria-label="Person to assign">
                      <SelectValue placeholder="Pick a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {action.type === 'notify' ? (
                  <>
                    <Field label="Who">
                      <Chips options={NOTIFY_AUDIENCES.map((audience) => ({ value: audience, label: AUDIENCE_LABELS[audience] }))} value={action.audiences ?? []} onChange={(audiences) => setAction(index, { ...action, audiences })} />
                    </Field>
                    <Field label="And these people">
                      <Chips options={members.map((member) => ({ value: member.userId, label: member.name }))} value={action.userIds ?? []} onChange={(userIds) => setAction(index, { ...action, userIds })} />
                    </Field>
                    <Field label="Message">
                      <Textarea
                        rows={2}
                        value={action.message ?? ''}
                        maxLength={AUTOMATION_LIMITS.messageMax}
                        onChange={(event) => setAction(index, { ...action, message: event.target.value })}
                        aria-label="Notification message"
                        placeholder="{{task}} moved to {{status}}"
                      />
                      <span className="text-xs text-muted-foreground">Fills in {'{{task}}'}, {'{{status}}'}, {'{{actor}}'} and, for GitHub triggers, {'{{pr}}'}.</span>
                    </Field>
                  </>
                ) : null}
              </Card>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-center" disabled={actions.length >= AUTOMATION_LIMITS.actionsMax} onClick={() => setActions([...actions, { type: 'set_priority', priority: 'high' }])}>
            <PlusIcon /> Add action
          </Button>
        </section>
      </div>
    </Modal>
  );
}

function StepLabel({ step, title, hint }: { step: string; title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{step}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** A set of toggle chips for picking several values. */
function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string; color?: string }[]; value: T[]; onChange: (value: T[]) => void }) {
  if (options.length === 0) return <span className="text-xs text-muted-foreground">Nothing to pick yet.</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((item) => item !== option.value) : [...value, option.value])}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', on ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {option.color ? <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
