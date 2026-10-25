import { useEffect, useState, type ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useServerForm } from '@/core/forms/use-server-form';
import { ColorPicker, PALETTE } from './color-picker';

export interface NameDialogValues {
  name: string;
  color: string;
}

interface NameDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  submitLabel: string;
  /** The API form whose rules apply, e.g. `space.create`. */
  formName: string;
  placeholder?: string;
  withColor?: boolean;
  defaultValues?: Partial<NameDialogValues>;
  onSubmit: (values: NameDialogValues) => Promise<unknown>;
}

/** Reusable "name this thing" dialog for spaces, lists, departments and similar. */
export function NameDialog({ trigger, title, description, submitLabel, formName, placeholder, withColor = false, defaultValues, onSubmit }: NameDialogProps) {
  const [open, setOpen] = useState(false);
  const { form, applyServerErrors, hints } = useServerForm<NameDialogValues>(formName, {
    defaultValues: { name: '', color: PALETTE[1], ...defaultValues },
  });

  useEffect(() => {
    if (open) form.reset({ name: '', color: PALETTE[1], ...defaultValues });
  }, [open, defaultValues, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      setOpen(false);
    } catch (error) {
      if (!applyServerErrors(error)) throw error;
    }
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
            <Input id="name-dialog-name" placeholder={placeholder} autoFocus maxLength={hints('name').maxLength} {...form.register('name')} />
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
