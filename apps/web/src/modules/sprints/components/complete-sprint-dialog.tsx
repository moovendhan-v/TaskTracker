import { useState, type ReactNode } from 'react';
import type { SprintResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BACKLOG = 'backlog';

interface CompleteSprintDialogProps {
  trigger: ReactNode;
  sprint: SprintResponse;
  plannedSprints: SprintResponse[];
  onComplete: (moveOpenTasksToSprintId: string | null) => Promise<unknown>;
}

export function CompleteSprintDialog({ trigger, sprint, plannedSprints, onComplete }: CompleteSprintDialogProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(BACKLOG);
  const [busy, setBusy] = useState(false);
  const openTasks = sprint.totalTasks - sprint.doneTasks;

  async function complete() {
    setBusy(true);
    try {
      await onComplete(target === BACKLOG ? null : target);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete {sprint.name}</DialogTitle>
          <DialogDescription>
            {sprint.doneTasks} done, {openTasks} unfinished. Unfinished tasks need somewhere to go.
          </DialogDescription>
        </DialogHeader>
        {openTasks > 0 ? (
          <div className="grid gap-1.5">
            <Label htmlFor="rollover-target">Move unfinished tasks to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="rollover-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BACKLOG}>Backlog</SelectItem>
                {plannedSprints.map((planned) => (
                  <SelectItem key={planned.id} value={planned.id}>
                    {planned.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void complete()} disabled={busy}>
            Complete sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
