import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { LEAVE_REASON_MAX, type LeaveTypeResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { previewWorkingDays } from '../lib/working-days';

const schema = z
  .object({
    leaveTypeId: z.string().min(1, 'Choose a type'),
    startDate: z.iso.date('Pick the first day'),
    endDate: z.iso.date('Pick the last day'),
    reason: z.string().max(LEAVE_REASON_MAX),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'End on or after the first day', path: ['endDate'] });
type Values = z.infer<typeof schema>;

interface LeaveRequestDialogProps {
  leaveTypes: LeaveTypeResponse[];
  onSubmit: (values: Values) => Promise<unknown>;
}

export function LeaveRequestDialog({ leaveTypes, onSubmit }: LeaveRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { leaveTypeId: leaveTypes[0]?.id ?? '', startDate: '', endDate: '', reason: '' },
  });
  const { errors } = form.formState;
  const [startDate, endDate, leaveTypeId] = form.watch(['startDate', 'endDate', 'leaveTypeId']);
  const days = startDate && endDate ? previewWorkingDays(startDate, endDate) : 0;
  const selectedType = leaveTypes.find((type) => type.id === leaveTypeId);

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    form.reset({ ...values, startDate: '', endDate: '', reason: '' });
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={leaveTypes.length === 0}>
          <CalendarPlusIcon /> Request time off
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
          <DialogDescription>Weekends aren't counted. Requests stay within one calendar year.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField id="leave-type" label="Type" error={errors.leaveTypeId?.message}>
            <Controller
              control={form.control}
              name="leaveTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="leave-type">
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="leave-start" label="First day" error={errors.startDate?.message}>
              <Input id="leave-start" type="date" {...form.register('startDate')} />
            </FormField>
            <FormField id="leave-end" label="Last day" error={errors.endDate?.message}>
              <Input id="leave-end" type="date" {...form.register('endDate')} />
            </FormField>
          </div>
          <FormField id="leave-reason" label="Note (optional)" error={errors.reason?.message}>
            <Textarea id="leave-reason" rows={2} {...form.register('reason')} />
          </FormField>
          <p className="text-sm text-muted-foreground" role="status">
            {days > 0 ? `${days} working day${days === 1 ? '' : 's'}` : 'Pick dates to see the working days.'}
            {selectedType && !selectedType.requiresApproval ? ' · approved automatically' : ''}
          </p>
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
