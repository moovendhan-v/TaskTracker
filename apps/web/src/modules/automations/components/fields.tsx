import {
  AUTOMATION_ACTIONS,
  AUTOMATION_LIMITS,
  FLOW_CONDITION_FIELDS,
  FLOW_LIMITS,
  NOTIFY_AUDIENCES,
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  TASK_TYPES,
  type AutomationAction,
  type FlowCondition,
} from '@taskflow/shared-types';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { ACTION_LABELS, AUDIENCE_LABELS, CATEGORY_LABELS, PRIORITY_LABELS } from '../lib/describe-rule';

export interface Choices {
  statuses: { id: string; name: string; color: string }[];
  lists: { id: string; name: string }[];
  members: { userId: string; name: string }[];
  /** Channels you can post in (for "Post in chat"). */
  channels: { id: string; name: string }[];
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string; color?: string }[]; value: T[]; onChange: (value: T[]) => void }) {
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
            className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs capitalize transition-colors', on ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {option.color ? <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PersonSelect({ value, onChange, members, label }: { value: string | null | undefined; onChange: (userId: string) => void; members: Choices['members']; label: string }) {
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
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
  );
}

const STARTERS: Record<AutomationAction['type'], AutomationAction> = {
  set_status: { type: 'set_status' },
  set_priority: { type: 'set_priority', priority: 'high' },
  assign: { type: 'assign' },
  unassign: { type: 'unassign' },
  notify: { type: 'notify', audiences: ['assignee'], message: '{{task}} needs a look' },
  comment: { type: 'comment', message: '' },
  set_due_date: { type: 'set_due_date', days: 2 },
  add_watcher: { type: 'add_watcher' },
  post_chat: { type: 'post_chat', message: 'New: {{task}}' },
  webhook: { type: 'webhook', url: '' },
};

/** Settings of one action, by its type. */
export function ActionFields({ action, onChange, choices }: { action: AutomationAction; onChange: (action: AutomationAction) => void; choices: Choices }) {
  return (
    <div className="grid gap-3">
      <Field label="Action">
        <Select value={action.type} onValueChange={(type: AutomationAction['type']) => onChange(STARTERS[type])}>
          <SelectTrigger aria-label="Action type">
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
      </Field>
      {action.type === 'post_chat' ? (
        <>
          <Field label="Channel">
            <Select value={action.channelId ?? ''} onValueChange={(channelId) => onChange({ ...action, channelId })}>
              <SelectTrigger aria-label="Channel to post in">
                <SelectValue placeholder="Pick a channel" />
              </SelectTrigger>
              <SelectContent>
                {choices.channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Message">
            <Textarea aria-label="Chat message" value={action.message ?? ''} maxLength={AUTOMATION_LIMITS.messageMax} onChange={(event) => onChange({ ...action, message: event.target.value })} rows={3} />
          </Field>
          <span className="text-xs text-muted-foreground">Posted as you. Fills in {'{{task}}'}, {'{{status}}'} and, for GitHub triggers, {'{{pr}}'}.</span>
        </>
      ) : null}
      {action.type === 'webhook' ? (
        <>
          <Field label="URL">
            <Input aria-label="Webhook URL" type="url" inputMode="url" placeholder="https://hooks.example.com/…" value={action.url ?? ''} maxLength={AUTOMATION_LIMITS.urlMax} onChange={(event) => onChange({ ...action, url: event.target.value })} />
          </Field>
          <span className="text-xs text-muted-foreground">
            Sends a signed JSON POST about the task once the change is saved, with up to three tries. Only hosts your administrator allows; https only. Once saved, “Signing secret” on the automation gives the secret to check the signature with.
          </span>
        </>
      ) : null}
      {action.type === 'set_status' ? (
        <Field label="Status">
          <Select value={action.statusId ?? ''} onValueChange={(statusId) => onChange({ ...action, statusId })}>
            <SelectTrigger aria-label="Status to set">
              <SelectValue placeholder="Pick a status" />
            </SelectTrigger>
            <SelectContent>
              {choices.statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {action.type === 'set_priority' ? (
        <Field label="Priority">
          <Select value={action.priority ?? ''} onValueChange={(priority: (typeof TASK_PRIORITIES)[number]) => onChange({ ...action, priority })}>
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
        </Field>
      ) : null}
      {action.type === 'assign' || action.type === 'add_watcher' ? (
        <Field label="Person">
          <PersonSelect value={action.userId} onChange={(userId) => onChange({ ...action, userId })} members={choices.members} label={action.type === 'assign' ? 'Person to assign' : 'Person to add as a watcher'} />
        </Field>
      ) : null}
      {action.type === 'notify' ? (
        <>
          <Field label="Who">
            <Chips options={NOTIFY_AUDIENCES.map((audience) => ({ value: audience, label: AUDIENCE_LABELS[audience] }))} value={action.audiences ?? []} onChange={(audiences) => onChange({ ...action, audiences })} />
          </Field>
          <Field label="And these people">
            <Chips options={choices.members.map((member) => ({ value: member.userId, label: member.name }))} value={action.userIds ?? []} onChange={(userIds) => onChange({ ...action, userIds })} />
          </Field>
        </>
      ) : null}
      {action.type === 'notify' || action.type === 'comment' ? (
        <Field label={action.type === 'comment' ? 'Comment' : 'Message'}>
          <Textarea
            rows={3}
            value={action.message ?? ''}
            maxLength={AUTOMATION_LIMITS.messageMax}
            onChange={(event) => onChange({ ...action, message: event.target.value })}
            aria-label={action.type === 'comment' ? 'Comment text' : 'Notification message'}
            placeholder="{{task}} moved to {{status}}"
          />
          <span className="text-xs text-muted-foreground">Fills in {'{{task}}'}, {'{{status}}'}, {'{{actor}}'} and, for GitHub triggers, {'{{pr}}'}. Plain text.</span>
        </Field>
      ) : null}
      {action.type === 'set_due_date' ? (
        <Field label="Due in how many days (empty clears it)">
          <Input
            type="number"
            min={0}
            max={FLOW_LIMITS.daysMax}
            value={action.days ?? ''}
            onChange={(event) => onChange({ ...action, days: event.target.value === '' ? null : Math.max(0, Math.min(FLOW_LIMITS.daysMax, Math.round(Number(event.target.value)))) })}
            aria-label="Days until due"
          />
        </Field>
      ) : null}
    </div>
  );
}

const CONDITION_LABELS: Record<FlowCondition['field'], string> = {
  status: 'Status',
  priority: 'Priority',
  type: 'Type',
  list: 'List',
  assignee: 'Assignee',
  due: 'Due date',
  title: 'Title',
};

const CONDITION_STARTERS: Record<FlowCondition['field'], FlowCondition> = {
  status: { field: 'status', categories: ['done'] },
  priority: { field: 'priority', priorities: ['urgent'] },
  type: { field: 'type', types: ['bug'] },
  list: { field: 'list', listIds: [] },
  assignee: { field: 'assignee', match: 'unassigned' },
  due: { field: 'due', match: 'within', days: 2 },
  title: { field: 'title', contains: '' },
};

/** Settings of one if-step's condition. */
export function ConditionFields({ condition, onChange, choices }: { condition: FlowCondition; onChange: (condition: FlowCondition) => void; choices: Choices }) {
  return (
    <div className="grid gap-3">
      <Field label="Check">
        <Select value={condition.field} onValueChange={(field: FlowCondition['field']) => onChange(CONDITION_STARTERS[field])}>
          <SelectTrigger aria-label="Condition">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FLOW_CONDITION_FIELDS.map((field) => (
              <SelectItem key={field} value={field}>
                {CONDITION_LABELS[field]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {condition.field === 'status' ? (
        <>
          <Field label="Is one of">
            <Chips options={choices.statuses.map((status) => ({ value: status.id, label: status.name, color: status.color }))} value={condition.statusIds ?? []} onChange={(statusIds) => onChange({ ...condition, statusIds })} />
          </Field>
          <Field label="Or any status that means">
            <Chips options={STATUS_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] }))} value={condition.categories ?? []} onChange={(categories) => onChange({ ...condition, categories })} />
          </Field>
        </>
      ) : null}
      {condition.field === 'priority' ? (
        <Field label="Is one of">
          <Chips options={TASK_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] }))} value={condition.priorities} onChange={(priorities) => onChange({ ...condition, priorities })} />
        </Field>
      ) : null}
      {condition.field === 'type' ? (
        <Field label="Is one of">
          <Chips options={TASK_TYPES.map((type) => ({ value: type, label: type }))} value={condition.types} onChange={(types) => onChange({ ...condition, types })} />
        </Field>
      ) : null}
      {condition.field === 'list' ? (
        <Field label="Is in">
          <Chips options={choices.lists.map((list) => ({ value: list.id, label: list.name }))} value={condition.listIds} onChange={(listIds) => onChange({ ...condition, listIds })} />
        </Field>
      ) : null}
      {condition.field === 'assignee' ? (
        <>
          <Chips
            options={[
              { value: 'unassigned', label: 'Nobody' },
              { value: 'anyone', label: 'Anyone' },
              { value: 'people', label: 'These people' },
            ]}
            value={[condition.match]}
            onChange={(values) => onChange({ ...condition, match: (values.find((value) => value !== condition.match) ?? condition.match) as 'unassigned' | 'anyone' | 'people' })}
          />
          {condition.match === 'people' ? (
            <Chips options={choices.members.map((member) => ({ value: member.userId, label: member.name }))} value={condition.userIds ?? []} onChange={(userIds) => onChange({ ...condition, userIds })} />
          ) : null}
        </>
      ) : null}
      {condition.field === 'due' ? (
        <>
          <Chips
            options={[
              { value: 'overdue', label: 'Overdue' },
              { value: 'within', label: 'Due within' },
              { value: 'none', label: 'No due date' },
            ]}
            value={[condition.match]}
            onChange={(values) => onChange({ ...condition, match: (values.find((value) => value !== condition.match) ?? condition.match) as 'overdue' | 'within' | 'none' })}
          />
          {condition.match === 'within' ? (
            <Field label="Days">
              <Input type="number" min={0} max={FLOW_LIMITS.daysMax} value={condition.days ?? 0} onChange={(event) => onChange({ ...condition, days: Math.max(0, Math.min(FLOW_LIMITS.daysMax, Math.round(Number(event.target.value)))) })} aria-label="Within days" />
            </Field>
          ) : null}
        </>
      ) : null}
      {condition.field === 'title' ? (
        <Field label="Contains (not case-sensitive)">
          <Input value={condition.contains} maxLength={FLOW_LIMITS.titleMax} onChange={(event) => onChange({ ...condition, contains: event.target.value })} aria-label="Title contains" />
        </Field>
      ) : null}
    </div>
  );
}
