import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { NAME_MAX, SPRINT_GOAL_MAX, SPRINT_MAX_DAYS } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { defaultSprintDates } from '../lib/sprint-dates';

const DAY_MS = 86_400_000;
const schema = z
  .object({
    name: z.string().trim().min(1, 'Give the sprint a name').max(NAME_MAX),
    goal: z.string().max(SPRINT_GOAL_MAX),
    startDate: z.iso.date('Pick a start date'),
    endDate: z.iso.date('Pick an end date'),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'End on or after the start date', path: ['endDate'] })
  .refine((v) => (Date.parse(v.endDate) - Date.parse(v.startDate)) / DAY_MS <= SPRINT_MAX_DAYS, {
    message: `A sprint can last at most ${SPRINT_MAX_DAYS} days`,
    path: ['endDate'],
  });
export type SprintFormValues = z.infer<typeof schema>;

interface SprintFormDialogProps {
  trigger: ReactNode;
  title: string;
  submitLabel: string;
  defaultValues?: Partial<SprintFormValues>;
  onSubmit: (values: SprintFormValues) => Promise<unknown>;
}

export function SprintFormDialog({ trigger, title, submitLabel, defaultValues, onSubmit }: SprintFormDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<SprintFormValues>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) form.reset({ name: '', goal: '', ...defaultSprintDates(), ...defaultValues });
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
