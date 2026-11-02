import { useNavigate } from '@tanstack/react-router';
import type { ChatChannelResponse, ChatMessageResponse } from '@taskflow/shared-types';
import { ArchiveIcon, BellIcon, BellOffIcon, HashIcon, LockIcon, LogOutIcon, MessagesSquareIcon, MoreHorizontalIcon, UserPlusIcon, UsersIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { UserAvatar } from '@/components/common/user-avatar';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { isNotFound } from '@/lib/errors';
import { DocTasksProvider } from '@/modules/documents';
import { useOpenTask } from '@/modules/tasks';
import { usePermissions } from '@/modules/workspaces';
import { AddPeopleDialog } from '../components/add-people-dialog';
import { ChannelList } from '../components/channel-list';
import { BrowseChannelsDialog, CreateTaskDialog, NewChannelDialog, NewDirectMessageDialog } from '../components/chat-dialogs';
import { Composer } from '../components/composer';
import { MessageFeed } from '../components/message-feed';
import { MessageItem } from '../components/message-item';
import { SearchDialog } from '../components/search-dialog';
import { useChatChannel, useChatChannels, useChatMessage, useChatMessages, useChatMutations, useChatThread, useTypingIn } from '../hooks/use-chat';
import { chatApi } from '../api/chat.api';
import { useMemberName } from '@/modules/members';
import { channelLabel } from '../lib/chat-display';

interface ChatPageProps {
  workspaceId: string;
  channelId: string | undefined;
  threadId: string | undefined;
}

/** Chat (v2 #2a): channel list, the conversation, and a thread on the right. */
export function ChatPage({ workspaceId, channelId, threadId }: ChatPageProps) {
  const navigate = useNavigate();
  const { can } = usePermissions(workspaceId);
  const allowed = can('chat.use');
  const { data: me } = useCurrentUser();
  const { data: channels } = useChatChannels(workspaceId, allowed);
  const [dialog, setDialog] = useState<'channel' | 'dm' | 'browse' | 'search' | null>(null);

  // "/" opens message search, unless you're typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault();
      setDialog('search');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const open = (id: string, thread?: string) => void navigate({ to: '/w/$workspaceId/chat/$channelId', params: { workspaceId, channelId: id }, search: (previous: Record<string, unknown>) => ({ ...previous, thread }) });
  const openChannel = (channel: ChatChannelResponse) => {
    setDialog(null);
    open(channel.id);
  };

  // /chat on its own opens the most recent conversation.
  const fallback = !channelId ? [...(channels ?? [])].sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt))[0] : undefined;
  useEffect(() => {
    if (fallback) void navigate({ to: '/w/$workspaceId/chat/$channelId', params: { workspaceId, channelId: fallback.id }, replace: true });
  }, [fallback, navigate, workspaceId]);

  if (!allowed) {
    return <EmptyState icon={<MessagesSquareIcon />} title="Chat isn't available" description="Your role in this workspace doesn't include chat. Ask an admin for chat access." />;
  }

  return (
    <DocTasksProvider workspaceId={workspaceId}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ChannelList channels={channels} activeId={channelId} onSelect={openChannel} onNewChannel={() => setDialog('channel')} onNewMessage={() => setDialog('dm')} onBrowse={() => setDialog('browse')} onSearch={() => setDialog('search')} />
        {channelId && me ? (
          <Conversation key={channelId} workspaceId={workspaceId} channelId={channelId} threadId={threadId} me={me.id} onThread={(thread) => open(channelId, thread)} />
        ) : channels && channels.length === 0 ? (
          <div className="grid flex-1 place-items-center">
            <EmptyState
              icon={<MessagesSquareIcon />}
              title="Start a conversation"
              description="Create a channel for your team, or send someone a direct message."
              action={
                <div className="flex gap-2">
                  <Button onClick={() => setDialog('channel')}>New channel</Button>
                  <Button variant="outline" onClick={() => setDialog('browse')}>
                    Browse channels
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
      {me ? (
        <>
          <NewChannelDialog workspaceId={workspaceId} me={me.id} open={dialog === 'channel'} onOpenChange={(value) => setDialog(value ? 'channel' : null)} onCreated={openChannel} />
          <NewDirectMessageDialog workspaceId={workspaceId} me={me.id} open={dialog === 'dm'} onOpenChange={(value) => setDialog(value ? 'dm' : null)} onOpened={openChannel} />
        </>
      ) : null}
      {dialog === 'search' ? <SearchDialog workspaceId={workspaceId} open onOpenChange={(value) => setDialog(value ? 'search' : null)} /> : null}
      <BrowseChannelsDialog workspaceId={workspaceId} open={dialog === 'browse'} onOpenChange={(value) => setDialog(value ? 'browse' : null)} onOpen={openChannel} />
    </DocTasksProvider>
  );
}

interface ConversationProps {
  workspaceId: string;
  channelId: string;
  threadId: string | undefined;
  me: string;
  onThread: (threadId: string | undefined) => void;
}

function Conversation({ workspaceId, channelId, threadId, me, onThread }: ConversationProps) {
  const channel = useChatChannel(workspaceId, channelId);
  const feed = useChatMessages(workspaceId, channelId);
  const mutations = useChatMutations(workspaceId);
  const openTask = useOpenTask();
  const [editing, setEditing] = useState<string | null>(null);
  const [taskFrom, setTaskFrom] = useState<ChatMessageResponse | null>(null);

  // Reading the newest message marks the channel read.
  const newest = feed.messages[feed.messages.length - 1]?.createdAt;
  const member = Boolean(channel.data?.myRole);
  const { mutate: markRead } = mutations.markRead;
  useEffect(() => {
    // +1 ms: the server keeps microseconds, so the newest message's own millisecond would still count as unread.
    if (newest && member) markRead({ channelId, at: new Date(new Date(newest).getTime() + 1).toISOString() });
  }, [newest, member, channelId, markRead]);

  if (channel.isError) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState icon={<HashIcon />} title={isNotFound(channel.error) ? 'Channel not found' : "Couldn't load this channel"} description="It may be private, or it no longer exists." />
      </div>
    );
  }

  const actions = {
    me,
    editing,
    setEditing,
    onSaveEdit: (message: ChatMessageResponse) => (body: string) =>
      mutations.edit.mutateAsync({ messageId: message.id, body }).then(
        () => setEditing(null),
        (error: unknown) => notify.error(error),
      ),
    onDelete: (message: ChatMessageResponse) => () => mutations.remove.mutateAsync(message.id).catch((error: unknown) => notify.error(error)),
    onCreateTask: (message: ChatMessageResponse) => () => setTaskFrom(message),
    onReact: (message: ChatMessageResponse) => (emoji: string) => mutations.react.mutate({ messageId: message.id, emoji }, { onError: (error) => notify.error(error) }),
    onCopyLink: (message: ChatMessageResponse) => () => {
      const url = `${window.location.origin}/w/${workspaceId}/chat/${channelId}?thread=${message.parentId ?? message.id}`;
      void navigator.clipboard.writeText(url).then(() => notify.success('Link copied'));
    },
  };
  const send = (body: string, parentId?: string) =>
    mutations.send.mutateAsync({ channelId, body, parentId }).catch((error: unknown) => {
      notify.error(error);
      throw error;
    });
  const lastMine = [...feed.messages].reverse().find((message) => message.authorId === me && message.kind === 'user' && !message.deleted);
  const archived = channel.data?.archived ?? false;
  const label = channel.data ? channelLabel(channel.data) : '';

  return (
    <>
      <section aria-label={label || 'Conversation'} className="flex min-w-0 flex-1 flex-col">
        <ChannelHeader workspaceId={workspaceId} channel={channel.data} />
        {feed.isPending ? (
          <div aria-hidden className="grid flex-1 content-end gap-4 p-4">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MessageFeed
            label={`Messages in ${label}`}
            messages={feed.messages}
            top={
              feed.hasNextPage ? (
                <div className="flex justify-center py-3">
                  <Button size="sm" variant="outline" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
                    Load earlier messages
                  </Button>
                </div>
              ) : channel.data ? (
                <ChannelIntro channel={channel.data} />
              ) : null
            }
            renderMessage={(message, head) => (
              <MessageItem
                message={message}
                head={head}
                mine={message.authorId === me}
                editing={editing === message.id}
                onEditing={(value) => setEditing(value ? message.id : null)}
                onSaveEdit={actions.onSaveEdit(message)}
                onDelete={actions.onDelete(message)}
                onReply={() => onThread(message.id)}
                onCreateTask={archived ? undefined : actions.onCreateTask(message)}
                onCopyLink={actions.onCopyLink(message)}
                onReact={archived ? undefined : actions.onReact(message)}
              />
            )}
          />
        )}
        <div className="px-3 pb-3">
          {archived ? (
            <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
              <ArchiveIcon className="size-4" /> This channel is archived. You can read it, but not post.
            </p>
          ) : (
            <>
              <TypingLine workspaceId={workspaceId} channelId={channelId} me={me} />
              <Composer
                key={channelId}
                autoFocus
                placeholder={`Message ${label}`}
                onSend={(body) => send(body)}
                onEditLast={lastMine ? () => setEditing(lastMine.id) : undefined}
                onTyping={member ? () => void chatApi.typing(workspaceId, channelId).catch(() => undefined) : undefined}
              />
            </>
          )}
        </div>
      </section>
      {threadId ? (
        <ThreadPane
          workspaceId={workspaceId}
          rootId={threadId}
          channelLabel={label}
          archived={archived}
          onClose={() => onThread(undefined)}
          onSend={(body) => send(body, threadId)}
          actions={actions}
        />
      ) : null}
      <CreateTaskDialog workspaceId={workspaceId} message={taskFrom} onOpenChange={(value) => !value && setTaskFrom(null)} onCreated={(taskId) => openTask(taskId)} />
    </>
  );
}

function ChannelIntro({ channel }: { channel: ChatChannelResponse }) {
  return (
    <div className="px-2 pt-8 pb-4">
      {channel.kind === 'dm' ? (
        <UserAvatar name={channel.dmMembers[0]?.name ?? '?'} className="mb-2 size-10 text-sm" />
      ) : (
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary-soft text-ring">{channel.kind === 'private' ? <LockIcon className="size-5" /> : <HashIcon className="size-5" />}</div>
      )}
      <h3 className="text-lg font-semibold">{channel.kind === 'dm' ? channelLabel(channel) : `Welcome to #${channel.name}`}</h3>
      <p className="text-sm text-muted-foreground">{channel.kind === 'dm' ? 'This is the start of your conversation.' : channel.topic || 'This is the very beginning of the channel.'}</p>
    </div>
  );
}

function ChannelHeader({ workspaceId, channel }: { workspaceId: string; channel: ChatChannelResponse | undefined }) {
  const navigate = useNavigate();
  const { can } = usePermissions(workspaceId);
  const mutations = useChatMutations(workspaceId);
  const [adding, setAdding] = useState(false);
  if (!channel) return <header className="h-12 shrink-0 border-b" />;
  const owner = channel.myRole === 'owner';
  const canManage = channel.kind !== 'dm' && (owner || (channel.kind === 'public' && can('chat.manage')));
  const fail = (error: unknown) => notify.error(error);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      {channel.kind === 'dm' ? (
        <UserAvatar name={channel.dmMembers[0]?.name ?? '?'} className="size-6 text-[10px]" />
      ) : channel.kind === 'private' ? (
        <LockIcon aria-hidden className="size-4 text-muted-foreground" />
      ) : (
        <HashIcon aria-hidden className="size-4 text-muted-foreground" />
      )}
      <h2 className="truncate text-[15px] font-semibold">{channel.kind === 'dm' ? channelLabel(channel) : channel.name}</h2>
      {channel.topic ? <span className="hidden truncate text-sm text-muted-foreground md:inline">· {channel.topic}</span> : null}
      <span className="flex-1" />
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <UsersIcon aria-hidden className="size-3.5" />
        {channel.memberCount}
      </span>
      {!channel.myRole && channel.kind === 'public' ? (
        <Button size="sm" onClick={() => mutations.join.mutate(channel.id, { onError: fail })}>
          Join
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Channel options">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {channel.myRole ? (
            <DropdownMenuItem onSelect={() => mutations.mute.mutate({ channelId: channel.id, muted: !channel.muted }, { onError: fail })}>
              {channel.muted ? <BellIcon /> : <BellOffIcon />} {channel.muted ? 'Unmute' : 'Mute'}
            </DropdownMenuItem>
          ) : null}
          {owner && channel.kind !== 'dm' && !channel.archived ? (
            <DropdownMenuItem onSelect={() => setAdding(true)}>
              <UserPlusIcon /> Add people
            </DropdownMenuItem>
          ) : null}
          {canManage ? (
            <DropdownMenuItem onSelect={() => mutations.archive.mutate({ channelId: channel.id, archived: !channel.archived }, { onError: fail })}>
              <ArchiveIcon /> {channel.archived ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
          ) : null}
          {channel.myRole && channel.kind !== 'dm' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  mutations.leave.mutate(channel.id, {
                    onSuccess: () => void navigate({ to: '/w/$workspaceId/chat', params: { workspaceId } }),
                    onError: fail,
                  })
                }
              >
                <LogOutIcon /> Leave channel
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AddPeopleDialog workspaceId={workspaceId} channelId={channel.id} open={adding} onOpenChange={setAdding} />
    </header>
  );
}

interface ThreadActions {
  me: string;
  editing: string | null;
  setEditing: (id: string | null) => void;
  onSaveEdit: (message: ChatMessageResponse) => (body: string) => Promise<unknown>;
  onDelete: (message: ChatMessageResponse) => () => Promise<unknown>;
  onCreateTask: (message: ChatMessageResponse) => () => void;
  onCopyLink: (message: ChatMessageResponse) => () => void;
  onReact: (message: ChatMessageResponse) => (emoji: string) => void;
}

function ThreadPane({ workspaceId, rootId, channelLabel: where, archived, onClose, onSend, actions }: {
  workspaceId: string;
  rootId: string;
  channelLabel: string;
  archived: boolean;
  onClose: () => void;
  onSend: (body: string) => Promise<unknown>;
  actions: ThreadActions;
}) {
  const root = useChatMessage(workspaceId, rootId);
  const thread = useChatThread(workspaceId, rootId);
  const replies = thread.data?.items ?? [];
  const item = (message: ChatMessageResponse, head: boolean) => (
    <MessageItem
      message={message}
      head={head}
      mine={message.authorId === actions.me}
      editing={actions.editing === message.id}
      onEditing={(value) => actions.setEditing(value ? message.id : null)}
      onSaveEdit={actions.onSaveEdit(message)}
      onDelete={actions.onDelete(message)}
      onCreateTask={archived ? undefined : actions.onCreateTask(message)}
      onCopyLink={actions.onCopyLink(message)}
      onReact={archived ? undefined : actions.onReact(message)}
    />
  );
  return (
    <aside
      aria-label="Thread"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onClose();
      }}
      className="flex w-[360px] shrink-0 flex-col border-l bg-background max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-popover"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-sm font-semibold">Thread</h2>
        <span className="truncate text-sm text-muted-foreground">{where}</span>
        <span className="flex-1" />
        <Button size="icon-sm" variant="ghost" aria-label="Close thread" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      {root.isError ? (
        <p className="p-4 text-sm text-muted-foreground">This thread isn't available.</p>
      ) : (
        <MessageFeed
          label="Replies"
          messages={replies}
          top={
            root.data ? (
              <div className="border-b pb-2">
                {item(root.data, true)}
                <p className="px-2 pt-2 text-xs text-muted-foreground">
                  {root.data.replyCount} {root.data.replyCount === 1 ? 'reply' : 'replies'}
                </p>
              </div>
            ) : null
          }
          renderMessage={item}
        />
      )}
      {!archived ? (
        <div className="px-3 pb-3">
          <Composer key={rootId} autoFocus placeholder="Reply…" onSend={onSend} />
        </div>
      ) : null}
    </aside>
  );
}

/** "Jordan is typing…" just above the composer. Keeps its height so the composer doesn't jump. */
function TypingLine({ workspaceId, channelId, me }: { workspaceId: string; channelId: string; me: string }) {
  const typing = useTypingIn(workspaceId, channelId, me);
  const nameOf = useMemberName(workspaceId);
  const names = typing.map((id) => nameOf(id) ?? 'Someone');
  const text =
    names.length === 0 ? '' : names.length === 1 ? `${names[0]} is typing…` : names.length === 2 ? `${names[0]} and ${names[1]} are typing…` : 'Several people are typing…';
  return (
    <p aria-live="polite" className="h-5 truncate px-1 text-xs text-muted-foreground">
      {text}
    </p>
  );
}
