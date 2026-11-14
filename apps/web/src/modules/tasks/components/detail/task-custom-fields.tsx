import type { CustomFieldResponse, TaskResponse } from '@taskflow/shared-types';
import { CheckIcon, ExternalLinkIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { notify } from '@/components/kit/notify';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { useMembers } from '@/modules/members';
import { useCustomFields } from '@/modules/spaces';
import { fieldInputText, fieldsForTask, parseFieldInput } from '../../lib/custom-field-values';

type Value = string | number | boolean | string[] | null;
const CLEAR = '__clear__';
const inputClass =
  'h-8 w-full min-w-0 rounded-md bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none';

/**
 * The task's custom fields (workspace-wide and this project's), each with an
 * editor for its type. Values are checked here and again on the server; a
 * required field can't be cleared.
 */
export function TaskCustomFields({ workspaceId, task, canEdit, onSave, row }: { workspaceId: string; task: TaskResponse; canEdit: boolean; onSave: (values: Record<string, Value>) => void; row: (label: string, content: ReactNode) => ReactNode }) {
  const { data: all = [] } = useCustomFields(workspaceId, 'task');
  const fields = fieldsForTask(all, task.spaceId);
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((field) => (
        <FieldRow key={field.id} row={row} field={field} value={(task.customFields[field.id] ?? null) as Value} workspaceId={workspaceId} disabled={!canEdit} onSave={(value) => onSave({ [field.id]: value })} />
      ))}
    </>
  );
}

function FieldRow({ field, value, workspaceId, disabled, onSave, row }: { field: CustomFieldResponse; value: Value; workspaceId: string; disabled: boolean; onSave: (value: Value) => void; row: (label: string, content: ReactNode) => ReactNode }) {
  const label = field.required ? `${field.name} *` : field.name;
  const save = (next: Value) => {
    if (next === null && field.required) return notify.error(`${field.name} is required`);
    if (JSON.stringify(next) !== JSON.stringify(value)) onSave(next);
  };
  return row(label, <FieldEditor field={field} value={value} workspaceId={workspaceId} disabled={disabled} onSave={save} />);
}

function FieldEditor({ field, value, workspaceId, disabled, onSave }: { field: CustomFieldResponse; value: Value; workspaceId: string; disabled: boolean; onSave: (value: Value) => void }) {
  const { data: members = [] } = useMembers(workspaceId);
  const name = field.name;
  switch (field.type) {
    case 'checkbox':
      return <Checkbox aria-label={name} checked={value === true} disabled={disabled} onCheckedChange={(checked) => onSave(checked === true ? true : field.required ? false : null)} />;
    case 'select':
    case 'user': {
      const options = field.type === 'user' ? members.map((member) => ({ id: member.userId, label: member.name, color: null })) : field.options;
      return (
        <Select value={typeof value === 'string' ? value : ''} disabled={disabled} onValueChange={(next) => onSave(next === CLEAR ? null : next)}>
          <SelectTrigger aria-label={name} className="h-8 border-transparent bg-transparent px-1.5 shadow-none hover:bg-muted">
            <SelectValue placeholder="Empty" />
          </SelectTrigger>
          <SelectContent>
            {!field.required && value !== null ? <SelectItem value={CLEAR}>Clear</SelectItem> : null}
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.color ? <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: option.color }} /> : null}
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case 'multi_select': {
      const chosen = Array.isArray(value) ? value : [];
      const labels = field.options.filter((option) => chosen.includes(option.id)).map((option) => option.label);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button type="button" aria-label={name} className={cn(inputClass, 'truncate text-left', !labels.length && 'text-muted-foreground')}>
              {labels.length ? labels.join(', ') : 'Empty'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {field.options.map((option) => {
              const on = chosen.includes(option.id);
              return (
                <DropdownMenuItem
                  key={option.id}
                  onSelect={(event) => {
                    event.preventDefault();
                    const next = on ? chosen.filter((id) => id !== option.id) : [...chosen, option.id];
                    onSave(next.length ? next : null);
                  }}
                >
                  <CheckIcon className={cn('size-3.5', !on && 'invisible')} />
                  {option.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    default:
      return <TextFieldEditor field={field} value={value} disabled={disabled} onSave={onSave} />;
  }
}

/** Text, number, money, date, link and email: typed, then saved on blur or Enter. */
function TextFieldEditor({ field, value, disabled, onSave }: { field: CustomFieldResponse; value: Value; disabled: boolean; onSave: (value: Value) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? fieldInputText(value);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseFieldInput(field.type, draft);
    setDraft(null);
    if ('error' in parsed) return void notify.error(`${field.name}: ${parsed.error}`);
    onSave(parsed.value);
  };
  const type = field.type === 'number' || field.type === 'money' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text';
  return (
    <span className="flex w-full min-w-0 items-center gap-1">
      {field.type === 'money' ? <span className="text-muted-foreground">$</span> : null}
      <input
        type={type}
        step={field.type === 'money' ? 0.01 : 'any'}
        aria-label={field.name}
        value={shown}
        disabled={disabled}
        placeholder="Empty"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setDraft(null);
        }}
        className={cn(inputClass, (field.type === 'number' || field.type === 'money') && 'font-mono')}
      />
      {field.type === 'url' && typeof value === 'string' && draft === null ? (
        <a href={value} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Open ${field.name}`}>
          <ExternalLinkIcon className="size-3.5" />
        </a>
      ) : null}
    </span>
  );
}
