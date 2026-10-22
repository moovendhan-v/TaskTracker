import { useState, type ReactNode } from 'react';
import { LEAVE_ALLOWANCE_MAX, NAME_MAX, type CreateLeaveTypeRequest, type LeaveTypeResponse } from '@taskflow/shared-types';
import { ColorPicker, PALETTE } from '@/components/common/color-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

interface LeaveTypeDialogProps {
  trigger: ReactNode;
  leaveType?: LeaveTypeResponse;
  onSave: (body: CreateLeaveTypeRequest) => Promise<unknown>;
}

export function LeaveTypeDialog({ trigger, leaveType, onSave }: LeaveTypeDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[1] as string);
  const [unlimited, setUnlimited] = useState(false);
  const [allowance, setAllowance] = useState('20');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [saving, setSaving] = useState(false);

  /** Opening the dialog starts from the saved values, so a cancelled edit leaves nothing behind. */
  function changeOpen(next: boolean) {
    if (next) {
      setName(leaveType?.name ?? '');
      setColor(leaveType?.color ?? (PALETTE[1] as string));
      setUnlimited(leaveType ? leaveType.annualAllowanceDays === null : false);
      setAllowance(String(leaveType?.annualAllowanceDays ?? 20));
      setRequiresApproval(leaveType?.requiresApproval ?? true);
    }
    setOpen(next);
  }

  const allowanceNumber = Number(allowance);
  const allowanceValid = unlimited || (Number.isInteger(allowanceNumber) && allowanceNumber >= 0 && allowanceNumber <= LEAVE_ALLOWANCE_MAX);

  async function save() {
    setSaving(true);
    try {
      await onSave({ name: name.trim(), color, annualAllowanceDays: unlimited ? null : allowanceNumber, requiresApproval });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{leaveType ? 'Edit leave type' : 'New leave type'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="leave-type-name" label="Name">
            <Input id="leave-type-name" value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} placeholder="e.g. Annual leave" />
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Colour</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <FormField
            id="leave-type-allowance"
            label="Days per year"
            error={allowanceValid ? undefined : `Use a whole number from 0 to ${LEAVE_ALLOWANCE_MAX}`}
          >
            <Input
              id="leave-type-allowance"
              type="number"
              min={0}
              max={LEAVE_ALLOWANCE_MAX}
              disabled={unlimited}
              value={unlimited ? '' : allowance}
              onChange={(event) => setAllowance(event.target.value)}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={unlimited} onCheckedChange={(checked) => setUnlimited(checked === true)} /> Unlimited
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={requiresApproval} onCheckedChange={(checked) => setRequiresApproval(checked === true)} /> Needs approval
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving || !name.trim() || !allowanceValid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
