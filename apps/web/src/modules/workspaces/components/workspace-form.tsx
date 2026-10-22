import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { NAME_MAX } from '@taskflow/shared-types';
import { ColorPicker, PALETTE } from '@/components/common/color-picker';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

const schema = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(NAME_MAX),
  color: z.string(),
});
export type WorkspaceFormValues = z.infer<typeof schema>;

interface WorkspaceFormProps {
  defaultValues?: Partial<WorkspaceFormValues>;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: WorkspaceFormValues) => void;
}

export function WorkspaceForm({ defaultValues, submitLabel, busy, onSubmit }: WorkspaceFormProps) {
  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', color: PALETTE[0], ...defaultValues },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <FormField id="workspace-name" label="Name" error={form.formState.errors.name?.message}>
        <Input id="workspace-name" placeholder="e.g. Northwind Studio" {...form.register('name')} />
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
