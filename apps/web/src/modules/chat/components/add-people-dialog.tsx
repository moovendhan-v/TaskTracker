import { CHAT_ADD_MEMBERS_MAX } from '@taskflow/shared-types';
import { useState } from 'react';
import { notify } from '@/components/kit/notify';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useMembers } from '@/modules/members';
import { useChatMembers, useChatMutations } from '../hooks/use-chat';

/** Owners add workspace members who aren't in the channel yet. */
export function AddPeopleDialog({ workspaceId, channelId, open, onOpenChange }: { workspaceId: string; channelId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: everyone = [] } = useMembers(workspaceId);
  const { data: inChannel = [] } = useChatMembers(workspaceId, channelId, open);
  const { addMembers } = useChatMutations(workspaceId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const already = new Set(inChannel.map((member) => member.userId));
  const shown = everyone.filter((member) => !already.has(member.userId) && member.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 50);
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length < CHAT_ADD_MEMBERS_MAX ? [...current, id] : current));
  const submit = () =>
    addMembers.mutate(
      { channelId, userIds: selected },
      {
        onSuccess: () => {
          setSelected([]);
          onOpenChange(false);
        },
        onError: (error) => notify.error(error),
      },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>They'll see the whole history of the channel.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find people" aria-label="Find people" />
        <ul className="max-h-60 overflow-y-auto rounded-lg border" aria-label="People">
          {shown.map((member) => (
            <li key={member.userId}>
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted">
                <Checkbox checked={selected.includes(member.userId)} onCheckedChange={() => toggle(member.userId)} aria-label={member.name} />
                <UserAvatar name={member.name} className="size-6 text-[10px]" />
                <span className="truncate">{member.name}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Everyone is already here.</li> : null}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={selected.length === 0 || addMembers.isPending} onClick={submit}>
            Add {selected.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
