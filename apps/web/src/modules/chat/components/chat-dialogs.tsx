import { CHAT_DM_MAX, CHAT_TOPIC_MAX, normalizeChannelName, taskTitleFromMessage, type ChatChannelResponse, type ChatMessageResponse } from '@taskflow/shared-types';
import { HashIcon, LockIcon, SearchIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { notify } from '@/components/kit/notify';
import { Segmented } from '@/components/kit/segmented';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLists } from '@/modules/lists';
import { useMembers } from '@/modules/members';
import { useBrowseChannels, useChatMutations } from '../hooks/use-chat';

interface DialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FormDialog({ open, onOpenChange, title, description, submitLabel, busy, canSubmit, onSubmit, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  busy: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !busy) onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Workspace members to pick from (everyone but you), filtered by name. */
function PeoplePicker({ workspaceId, me, selected, onChange, max }: { workspaceId: string; me: string; selected: string[]; onChange: (ids: string[]) => void; max: number }) {
  const { data: members = [] } = useMembers(workspaceId);
  const [search, setSearch] = useState('');
  const shown = members.filter((member) => member.userId !== me && member.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 50);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : selected.length < max ? [...selected, id] : selected);
  return (
    <div className="grid gap-2">
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find people" aria-label="Find people" className="pl-8" />
      </div>
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
        {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Nobody matches.</li> : null}
      </ul>
      <p className="text-xs text-muted-foreground">{selected.length ? `${selected.length} selected` : 'Pick people'}{max < 50 ? ` · up to ${max}` : ''}</p>
    </div>
  );
}

/**
 * Rename a channel or change its topic. Owners can, and so can people with
 * chat.manage for public channels (the server checks, and audits the latter).
 */
export function EditChannelDialog({ workspaceId, channel, open, onOpenChange }: DialogProps & { channel: ChatChannelResponse }) {
  const { updateChannel } = useChatMutations(workspaceId);
  const [name, setName] = useState(channel.name ?? '');
  const [topic, setTopic] = useState(channel.topic);
  const normalized = normalizeChannelName(name);
  const changed = normalized !== channel.name || topic.trim() !== channel.topic;
  const submit = () =>
    updateChannel.mutate(
      { channelId: channel.id, ...(normalized !== channel.name ? { name: normalized } : {}), topic: topic.trim() },
      { onSuccess: () => onOpenChange(false), onError: (error) => notify.error(error) },
    );
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Edit channel" description="Everyone in the channel sees the new name and topic." submitLabel="Save" busy={updateChannel.isPending} canSubmit={normalized.length > 0 && changed} onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-channel-name">Name</Label>
        <div className="relative">
          {channel.kind === 'private' ? <LockIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /> : <HashIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />}
          <Input id="edit-channel-name" autoFocus value={name} maxLength={90} onChange={(event) => setName(event.target.value)} className="pl-8" />
        </div>
        {name && normalized !== name ? <p className="text-xs text-muted-foreground">Will be saved as #{normalized || '…'}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-channel-topic">Topic</Label>
        <Input id="edit-channel-topic" value={topic} maxLength={CHAT_TOPIC_MAX} onChange={(event) => setTopic(event.target.value)} placeholder="What it's about (empty to clear)" />
      </div>
    </FormDialog>
  );
}

export function NewChannelDialog({ workspaceId, me, open, onOpenChange, onCreated }: DialogProps & { me: string; onCreated: (channel: ChatChannelResponse) => void }) {
  const { createChannel } = useChatMutations(workspaceId);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState<'public' | 'private'>('public');
  const [people, setPeople] = useState<string[]>([]);
  const normalized = normalizeChannelName(name);
  const submit = () =>
    createChannel.mutate(
      { name: normalized, topic: topic.trim() || undefined, kind, memberIds: people },
      {
        onSuccess: (channel) => {
          onOpenChange(false);
          setName('');
          setTopic('');
          setPeople([]);
          onCreated(channel);
        },
        onError: (error) => notify.error(error),
      },
    );
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New channel" description="Channels are where a team talks about a topic." submitLabel="Create" busy={createChannel.isPending} canSubmit={normalized.length > 0} onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor="channel-name">Name</Label>
        <div className="relative">
          {kind === 'private' ? <LockIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /> : <HashIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />}
          <Input id="channel-name" autoFocus value={name} maxLength={90} onChange={(event) => setName(event.target.value)} placeholder="e.g. platform" className="pl-8" />
        </div>
        {name && normalized !== name ? <p className="text-xs text-muted-foreground">Will be created as #{normalized || '…'}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="channel-topic">Topic (optional)</Label>
        <Input id="channel-topic" value={topic} maxLength={CHAT_TOPIC_MAX} onChange={(event) => setTopic(event.target.value)} placeholder="What it's about" />
      </div>
      <Segmented
        label="Who can join"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'public', label: 'Anyone in the workspace' },
          { value: 'private', label: 'Invited people only' },
        ]}
      />
      {kind === 'private' ? <PeoplePicker workspaceId={workspaceId} me={me} selected={people} onChange={setPeople} max={50} /> : null}
    </FormDialog>
  );
}

export function NewDirectMessageDialog({ workspaceId, me, open, onOpenChange, onOpened }: DialogProps & { me: string; onOpened: (channel: ChatChannelResponse) => void }) {
  const { openDm } = useChatMutations(workspaceId);
  const [people, setPeople] = useState<string[]>([]);
  const submit = () =>
    openDm.mutate(people, {
      onSuccess: (channel) => {
        onOpenChange(false);
        setPeople([]);
        onOpened(channel);
      },
      onError: (error) => notify.error(error),
    });
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New message" description="A private conversation with one or a few people." submitLabel="Start" busy={openDm.isPending} canSubmit={people.length > 0} onSubmit={submit}>
      <PeoplePicker workspaceId={workspaceId} me={me} selected={people} onChange={setPeople} max={CHAT_DM_MAX - 1} />
    </FormDialog>
  );
}

export function BrowseChannelsDialog({ workspaceId, open, onOpenChange, onOpen }: DialogProps & { onOpen: (channel: ChatChannelResponse) => void }) {
  const [search, setSearch] = useState('');
  const { data = [], isPending } = useBrowseChannels(workspaceId, search, open);
  const { join } = useChatMutations(workspaceId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Browse channels</DialogTitle>
          <DialogDescription>Public channels in this workspace.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={search} maxLength={80} onChange={(event) => setSearch(event.target.value)} placeholder="Search channels" aria-label="Search channels" />
        <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border" aria-label="Public channels">
          {data.map((channel) => (
            <li key={channel.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">#{channel.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
                  {channel.topic ? ` · ${channel.topic}` : ''}
                </p>
              </div>
              {channel.myRole ? (
                <Button size="sm" variant="outline" onClick={() => onOpen(channel)}>
                  Open
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={join.isPending}
                  onClick={() => join.mutate(channel.id, { onSuccess: (joined) => onOpen(joined), onError: (error) => notify.error(error) })}
                >
                  Join
                </Button>
              )}
            </li>
          ))}
          {!isPending && data.length === 0 ? <li className="px-3 py-4 text-sm text-muted-foreground">No public channels match.</li> : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTaskDialog({ workspaceId, message, onOpenChange, onCreated }: { workspaceId: string; message: ChatMessageResponse | null; onOpenChange: (open: boolean) => void; onCreated: (taskId: string) => void }) {
  const { data: lists = [] } = useLists(workspaceId);
  const { createTask } = useChatMutations(workspaceId);
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState('');
  const chosenList = listId || lists[0]?.id || '';
  const suggested = message ? taskTitleFromMessage(message.body) : '';
  const submit = () => {
    if (!message) return;
    createTask.mutate(
      { messageId: message.id, listId: chosenList, title: title.trim() || undefined },
      {
        onSuccess: (line) => {
          onOpenChange(false);
          setTitle('');
          if (line.taskId) onCreated(line.taskId);
        },
        onError: (error) => notify.error(error),
      },
    );
  };
  return (
    <FormDialog
      open={message !== null}
      onOpenChange={onOpenChange}
      title="Create task from message"
      description="The task links back here, and the thread notes it."
      submitLabel="Create task"
      busy={createTask.isPending}
      canSubmit={Boolean(chosenList) && Boolean(title.trim() || suggested)}
      onSubmit={submit}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" autoFocus value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder={suggested || 'Task title'} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="task-list">List</Label>
        <select id="task-list" value={chosenList} onChange={(event) => setListId(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>
    </FormDialog>
  );
}
