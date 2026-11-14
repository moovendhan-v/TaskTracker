import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { STATUS_CATEGORIES, STATUS_NAME_MAX, WIP_LIMIT_MAX, type StatusCategory, type TaskStatusResponse } from '@taskflow/shared-types';
import { PALETTE } from '@/components/common/color-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/errors';
import { useStatuses } from '@/modules/tasks';
import { useStatusMutations } from '../../hooks/use-spaces';

export const CATEGORY_META: Record<StatusCategory, { label: string; hint: string }> = {
  unstarted: { label: 'Not started', hint: 'Waiting to be picked up' },
  started: { label: 'Active', hint: 'Someone is working on it' },
  review: { label: 'In review', hint: 'Done, waiting for a check' },
  blocked: { label: 'Blocked', hint: 'Can’t move until something else does' },
  done: { label: 'Done', hint: 'Finished; counts as closed' },
  cancelled: { label: 'Cancelled', hint: 'Dropped; counts as closed' },
};

interface StatusSettingsProps {
  workspaceId: string;
  spaceId: string;
  canManage: boolean;
}

/**
 * The statuses tasks move through in this space, grouped by what they mean.
 * Sprints, the backlog and overdue warnings go by the category, so renaming
 * or adding statuses never breaks them.
 */
export function StatusSettings({ workspaceId, spaceId, canManage }: StatusSettingsProps) {
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId);
  const mutations = useStatusMutations(workspaceId, spaceId);
  const [dragged, setDragged] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TaskStatusResponse | null>(null);

  const reorder = (ids: string[]) => mutations.reorder.mutate(ids);
  const move = (id: string, offset: number) => {
    const ids = statuses.map((status) => status.id);
    const from = ids.indexOf(id);
    const to = from + offset;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    reorder(ids);
  };
  const dropOn = (targetId: string) => {
    if (!dragged || dragged === targetId) return;
    const ids = statuses.map((status) => status.id).filter((id) => id !== dragged);
    ids.splice(ids.indexOf(targetId), 0, dragged);
    reorder(ids);
    setDragged(null);
  };

  return (
    <div className="grid gap-4">
      <ol className="divide-y rounded-lg border">
        {statuses.map((status, index) => (
          <li
            key={status.id}
            draggable={canManage}
            onDragStart={() => setDragged(status.id)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => canManage && event.preventDefault()}
            onDrop={() => dropOn(status.id)}
            className={cn('flex items-center gap-2 bg-card px-2 py-1.5', dragged === status.id && 'opacity-50')}
          >
            {canManage ? <GripVerticalIcon className="size-4 cursor-grab text-muted-foreground" aria-hidden /> : null}
            <ColorSwatch
              color={status.color}
              disabled={!canManage}
              onChange={(color) => mutations.update.mutate({ statusId: status.id, body: { color } })}
            />
            {canManage ? (
              <Input
                defaultValue={status.name}
                maxLength={STATUS_NAME_MAX}
                aria-label="Status name"
                className="h-8 max-w-56 border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input"
                onBlur={(event) => {
                  const name = event.target.value.trim();
                  if (name && name !== status.name) mutations.update.mutate({ statusId: status.id, body: { name } });
                  else event.target.value = status.name;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            ) : (
              <span className="flex-1 text-sm">{status.name}</span>
            )}
            <span className="flex-1" />
            {canManage ? (
              <Input
                key={`limit-${status.wipLimit ?? ''}`}
                type="number"
                min={1}
                max={WIP_LIMIT_MAX}
                defaultValue={status.wipLimit ?? ''}
                placeholder="No limit"
                aria-label={`Board limit for ${status.name}`}
                title="Work-in-progress limit for this board column; the board warns at and over it"
                className="h-8 w-24 font-mono"
                onBlur={(event) => {
                  const raw = event.target.value.trim();
                  const next = raw === '' ? null : Math.round(Number(raw));
                  if (next !== null && !(next >= 1 && next <= WIP_LIMIT_MAX)) {
                    event.target.value = status.wipLimit === null ? '' : String(status.wipLimit);
                    return;
                  }
                  if (next !== status.wipLimit) mutations.update.mutate({ statusId: status.id, body: { wipLimit: next } });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            ) : status.wipLimit !== null ? (
              <span className="text-xs text-muted-foreground">Limit {status.wipLimit}</span>
            ) : null}
            {canManage ? (
              <Select value={status.category} onValueChange={(category: StatusCategory) => mutations.update.mutate({ statusId: status.id, body: { category } })}>
                <SelectTrigger className="h-8 w-36" aria-label={`What ${status.name} means`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_META[category].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-muted-foreground">{CATEGORY_META[status.category].label}</span>
            )}
            {canManage ? (
              <div className="flex">
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${status.name} up`} disabled={index === 0} onClick={() => move(status.id, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${status.name} down`} disabled={index === statuses.length - 1} onClick={() => move(status.id, 1)}>
                  <ArrowDownIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${status.name}`} disabled={statuses.length <= 1} onClick={() => setDeleting(status)}>
                  <TrashIcon />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {canManage ? <NewStatusRow onCreate={(body) => mutations.create.mutateAsync(body)} nextColor={PALETTE[statuses.length % PALETTE.length] ?? '#64748b'} /> : null}
      {deleting ? (
        <DeleteStatusDialog
          status={deleting}
          others={statuses.filter((status) => status.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDelete={(moveTasksTo) => mutations.remove.mutateAsync({ statusId: deleting.id, moveTasksTo }).then(() => setDeleting(null))}
        />
      ) : null}
    </div>
  );
}

function ColorSwatch({ color, disabled, onChange }: { color: string; disabled: boolean; onChange: (color: string) => void }) {
  if (disabled) return <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="size-4 shrink-0 rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" style={{ backgroundColor: color }} aria-label="Change colour" />
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <div className="flex gap-1.5">
          {PALETTE.map((option) => (
            <button key={option} type="button" aria-label={option} onClick={() => onChange(option)} className={cn('size-6 rounded-full', option === color && 'ring-2 ring-foreground/40 ring-offset-2 ring-offset-background')} style={{ backgroundColor: option }} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NewStatusRow({ onCreate, nextColor }: { onCreate: (body: { name: string; color: string; category: StatusCategory }) => Promise<unknown>; nextColor: string }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>('started');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), color: nextColor, category });
      setName('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New status, e.g. QA" maxLength={STATUS_NAME_MAX} aria-label="New status name" className="h-8 max-w-56" />
      <Select value={category} onValueChange={(value: StatusCategory) => setCategory(value)}>
        <SelectTrigger className="h-8 w-36" aria-label="What the new status means">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_CATEGORIES.map((option) => (
            <SelectItem key={option} value={option}>
              {CATEGORY_META[option].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={busy || !name.trim()}>
        <PlusIcon /> Add status
      </Button>
      <span className="text-xs text-muted-foreground">{CATEGORY_META[category].hint}</span>
    </form>
  );
}

function DeleteStatusDialog({ status, others, onClose, onDelete }: { status: TaskStatusResponse; others: TaskStatusResponse[]; onClose: () => void; onDelete: (moveTo: string) => Promise<unknown> }) {
  const [target, setTarget] = useState(others.find((other) => other.category === status.category)?.id ?? others[0]?.id ?? '');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{status.name}”?</DialogTitle>
          <DialogDescription>Tasks in this status move to the one you pick.</DialogDescription>
        </DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger aria-label="Move its tasks to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {others.map((other) => (
              <SelectItem key={other.id} value={other.id}>
                <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: other.color }} />
                {other.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!target} onClick={() => void onDelete(target)}>
            Delete status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
