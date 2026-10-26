import { Controller } from 'react-hook-form';
import { ColorPicker, PALETTE } from '@/components/common/color-picker';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useServerForm } from '@/core/forms/use-server-form';

export interface WorkspaceFormValues {
  name: string;
  color: string;
}

interface WorkspaceFormProps {
  defaultValues?: Partial<WorkspaceFormValues>;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: WorkspaceFormValues) => void;
}

export function WorkspaceForm({ defaultValues, submitLabel, busy, onSubmit }: WorkspaceFormProps) {
  const { form, hints } = useServerForm<WorkspaceFormValues>('workspace.create', {
    defaultValues: { name: '', color: PALETTE[0], ...defaultValues },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <FormField id="workspace-name" label="Name" error={form.formState.errors.name?.message}>
        <Input id="workspace-name" placeholder="e.g. Northwind Studio" maxLength={hints('name').maxLength} {...form.register('name')} />
      </FormField>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Colour</span>
        <Controller control={form.control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
      </div>
      <Button type="submit" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
