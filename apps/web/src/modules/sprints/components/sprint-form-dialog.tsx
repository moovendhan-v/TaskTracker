import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useServerForm } from '@/core/forms/use-server-form';
import { defaultSprintDates } from '../lib/sprint-dates';

export interface SprintFormValues {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
}

interface SprintFormDialogProps {
  trigger: ReactNode;
  title: string;
  submitLabel: string;
  /** `sprint.create` or `sprint.update`: whose rules apply. */
  formName: 'sprint.create' | 'sprint.update';
  defaultValues?: Partial<SprintFormValues>;
  onSubmit: (values: SprintFormValues) => Promise<unknown>;
}

export function SprintFormDialog({ trigger, title, submitLabel, formName, defaultValues, onSubmit }: SprintFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { form, applyServerErrors } = useServerForm<SprintFormValues>(formName);
  const { errors } = form.formState;

  useEffect(() => {
    if (open) form.reset({ name: '', goal: '', ...defaultSprintDates(), ...defaultValues });
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
          <DialogDescription>Sprints are short, time-boxed pushes with one clear goal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField id="sprint-name" label="Name" error={errors.name?.message}>
            <Input id="sprint-name" placeholder="e.g. Sprint 12" {...form.register('name')} />
          </FormField>
          <FormField id="sprint-goal" label="Goal" error={errors.goal?.message}>
            <Textarea id="sprint-goal" rows={2} placeholder="What does done look like?" {...form.register('goal')} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="sprint-start" label="Starts" error={errors.startDate?.message}>
              <Input id="sprint-start" type="date" {...form.register('startDate')} />
            </FormField>
            <FormField id="sprint-end" label="Ends" error={errors.endDate?.message}>
              <Input id="sprint-end" type="date" {...form.register('endDate')} />
            </FormField>
          </div>
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
