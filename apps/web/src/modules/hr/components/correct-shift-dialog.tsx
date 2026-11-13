import { ATTENDANCE_LIMITS, type AttendanceShiftResponse } from '@taskflow/shared-types';
import { useState, type ReactNode } from 'react';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCorrectShift } from '../hooks/use-attendance';
import { fromLocalInput, toLocalInput } from '../lib/attendance';

/**
 * HR fixes a shift's times (a forgotten clock-out, a wrong start) and says why.
 * The server keeps breaks inside the new times and records who changed it.
 */
export function CorrectShiftDialog({ workspaceId, shift, personName, trigger }: { workspaceId: string; shift: AttendanceShiftResponse; personName: string; trigger: ReactNode }) {
  const correct = useCorrectShift(workspaceId);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  /** When the dialog opened: ends after it are in the future (the server checks again). */
  const [openedAt, setOpenedAt] = useState(0);

  function changeOpen(next: boolean) {
    if (next) {
      setStart(toLocalInput(shift.startedAt));
      setEnd(shift.endedAt ? toLocalInput(shift.endedAt) : '');
      setReason('');
      setOpenedAt(Date.now());
    }
    setOpen(next);
  }

  const startedAt = fromLocalInput(start);
  const endedAt = fromLocalInput(end);
  const hours = startedAt && endedAt ? (Date.parse(endedAt) - Date.parse(startedAt)) / 3_600_000 : null;
  const timeError =
    !startedAt || !endedAt
      ? 'Set both times'
      : hours! <= 0
        ? 'The shift must end after it starts'
        : hours! > ATTENDANCE_LIMITS.shiftHoursMax
          ? `A shift can be at most ${ATTENDANCE_LIMITS.shiftHoursMax} hours`
          : Date.parse(endedAt) > openedAt + 60_000
            ? 'It can’t end in the future'
            : null;
  const valid = !timeError && reason.trim().length > 0;

  async function save() {
    if (!startedAt || !endedAt) return;
    try {
      await correct.mutateAsync({ shiftId: shift.id, input: { startedAt, endedAt, reason: reason.trim() } });
      notify.success(`${personName}’s shift was corrected`);
      setOpen(false);
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct {personName}’s shift</DialogTitle>
          <DialogDescription>
            {shift.endedAt ? 'Fix the clock-in or clock-out time.' : 'They’re still clocked in. Set when the shift really ended to clock them out.'} Breaks outside the new times are dropped. The change is logged.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="shift-start" label="Clocked in">
              <Input id="shift-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
            </FormField>
            <FormField id="shift-end" label="Clocked out" error={start && end ? (timeError ?? undefined) : undefined}>
              <Input id="shift-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
            </FormField>
          </div>
          <FormField id="shift-reason" label="Reason" hint="Shown on the shift, and kept in the audit log">
            <Textarea
              id="shift-reason"
              rows={2}
              value={reason}
              maxLength={ATTENDANCE_LIMITS.correctionReasonMax}
              placeholder="e.g. Forgot to clock out"
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || correct.isPending} onClick={() => void save()}>
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
