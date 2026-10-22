import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { NAME_MAX } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ColorPicker, PALETTE } from './color-picker';

const schema = z.object({ name: z.string().trim().min(1, 'Enter a name').max(NAME_MAX), color: z.string() });
export type NameDialogValues = z.infer<typeof schema>;

interface NameDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  submitLabel: string;
  placeholder?: string;
  withColor?: boolean;
  defaultValues?: Partial<NameDialogValues>;
  onSubmit: (values: NameDialogValues) => Promise<unknown>;
}

/** Reusable "name this thing" dialog for spaces, lists, departments and similar. */
export function NameDialog({ trigger, title, description, submitLabel, placeholder, withColor = false, defaultValues, onSubmit }: NameDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<NameDialogValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', color: PALETTE[1], ...defaultValues },
  });

  useEffect(() => {
    if (open) form.reset({ name: '', color: PALETTE[1], ...defaultValues });
  }, [open, defaultValues, form]);

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField id="name-dialog-name" label="Name" error={form.formState.errors.name?.message}>
            <Input id="name-dialog-name" placeholder={placeholder} autoFocus {...form.register('name')} />
          </FormField>
          {withColor ? (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Colour</span>
              <Controller control={form.control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
