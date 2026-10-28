import { PencilIcon, PlusIcon, TrashIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { CUSTOM_FIELD_LIMITS, CUSTOM_FIELD_TYPES, type CustomFieldOption, type CustomFieldResponse, type CustomFieldType } from '@taskflow/shared-types';
import { PALETTE } from '@/components/common/color-picker';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { useCustomFieldMutations, useCustomFields } from '../../hooks/use-spaces';

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  money: 'Money',
  date: 'Date',
  checkbox: 'Checkbox',
  select: 'Dropdown',
  multi_select: 'Labels (many)',
  url: 'Link',
  email: 'Email',
  user: 'Person',
};

const hasOptions = (type: CustomFieldType) => type === 'select' || type === 'multi_select';

interface CustomFieldSettingsProps {
  workspaceId: string;
  spaceId: string;
  canManage: boolean;
}

/** Extra fields on this project's tasks (and the workspace-wide ones that apply here too). */
export function CustomFieldSettings({ workspaceId, spaceId, canManage }: CustomFieldSettingsProps) {
  const { data: fields = [] } = useCustomFields(workspaceId, 'task');
  const mutations = useCustomFieldMutations(workspaceId);
  const [editing, setEditing] = useState<CustomFieldResponse | 'new' | null>(null);
  const own = fields.filter((field) => field.spaceId === spaceId);
  const shared = fields.filter((field) => field.spaceId === null);

  return (
    <div className="grid gap-3">
      {own.length === 0 && shared.length === 0 ? <p className="text-sm text-muted-foreground">No custom fields yet. Add one to track things like story points or a client name.</p> : null}
      {own.length > 0 || shared.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {[...own, ...shared].map((field) => (
            <li key={field.id} className="flex items-center gap-3 bg-card px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {field.name}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABELS[field.type]}
                  {hasOptions(field.type) ? ` · ${field.options.length} options` : ''}
                </p>
              </div>
              {field.spaceId === null ? <Badge className="bg-secondary text-secondary-foreground">Every project</Badge> : null}
              {canManage && field.spaceId === spaceId ? (
                <>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${field.name}`} onClick={() => setEditing(field)}>
                    <PencilIcon />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${field.name}`}>
                        <TrashIcon />
                      </Button>
                    }
                    title={`Delete “${field.name}”?`}
                    description="Values stored on tasks are removed too."
                    confirmLabel="Delete field"
                    onConfirm={() => mutations.remove.mutateAsync(field.id)}
                  />
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canManage ? (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setEditing('new')}>
          <PlusIcon /> Add field
        </Button>
      ) : null}
      {editing ? (
        <FieldDialog
          field={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (editing === 'new') await mutations.create.mutateAsync({ ...values, entity: 'task', spaceId });
            else await mutations.update.mutateAsync({ fieldId: editing.id, body: { name: values.name, options: values.options, required: values.required } });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

interface FieldValues {
  name: string;
  type: CustomFieldType;
  options: CustomFieldOption[];
  required: boolean;
}

function FieldDialog({ field, onClose, onSave }: { field: CustomFieldResponse | null; onClose: () => void; onSave: (values: FieldValues) => Promise<void> }) {
  const [values, setValues] = useState<FieldValues>({
    name: field?.name ?? '',
    type: field?.type ?? 'text',
    options: field?.options ?? [],
    required: field?.required ?? false,
  });
  const [option, setOption] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<FieldValues>) => setValues((current) => ({ ...current, ...patch }));

  const addOption = () => {
    const label = option.trim();
    if (!label || values.options.length >= CUSTOM_FIELD_LIMITS.optionsMax) return;
    // The API keeps given ids so stored values stay attached; new ones only need to be unique here.
    set({ options: [...values.options, { id: crypto.randomUUID().slice(0, 8), label, color: PALETTE[values.options.length % PALETTE.length] ?? null }] });
    setOption('');
  };

  const submit = async () => {
    setBusy(true);
    try {
      await onSave({ ...values, name: values.name.trim() });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? `Edit ${field.name}` : 'New field'}</DialogTitle>
          <DialogDescription>Shown on every task in this project, and usable in filters and sorting.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormField id="field-name" label="Name">
            <Input id="field-name" value={values.name} maxLength={CUSTOM_FIELD_LIMITS.nameMax} autoFocus placeholder="e.g. Story points" onChange={(event) => set({ name: event.target.value })} />
          </FormField>
          <FormField id="field-type" label="Type">
            <Select value={values.type} disabled={Boolean(field)} onValueChange={(type: CustomFieldType) => set({ type })}>
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {hasOptions(values.type) ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium">Options</span>
              <div className="flex flex-wrap gap-1.5">
                {values.options.map((item) => (
                  <span key={item.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color ?? undefined }} />
                    {item.label}
                    <button type="button" aria-label={`Remove ${item.label}`} onClick={() => set({ options: values.options.filter((other) => other.id !== item.id) })}>
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={option}
                  maxLength={60}
                  placeholder="Add an option"
                  aria-label="New option"
                  onChange={(event) => setOption(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addOption}>
                  Add
                </Button>
              </div>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={values.required} onCheckedChange={(checked) => set({ required: checked === true })} /> Required on new tasks
          </label>
          <DialogFooter>
            <Button type="submit" disabled={busy || !values.name.trim() || (hasOptions(values.type) && values.options.length === 0)}>
              {field ? 'Save' : 'Create field'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
