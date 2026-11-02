import type { ChatChannelResponse } from '@taskflow/shared-types';
import { BellOffIcon, CompassIcon, HashIcon, LockIcon, PlusIcon, SearchIcon, SquarePenIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { channelLabel } from '../lib/chat-display';

interface ChannelListProps {
  channels: ChatChannelResponse[] | undefined;
  activeId: string | undefined;
  onSelect: (channel: ChatChannelResponse) => void;
  onNewChannel: () => void;
  onNewMessage: () => void;
  onBrowse: () => void;
  onSearch: () => void;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Row({ channel, active, onSelect }: { channel: ChatChannelResponse; active: boolean; onSelect: () => void }) {
  const unread = !channel.muted && channel.unreadCount > 0;
  const label = channelLabel(channel);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          active ? 'bg-selected text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          unread && !active && 'font-semibold text-foreground',
          channel.archived && 'opacity-60',
        )}
      >
        {channel.kind === 'dm' ? (
          <UserAvatar name={channel.dmMembers[0]?.name ?? '?'} className="size-5 text-[9px]" />
        ) : channel.kind === 'private' ? (
          <LockIcon aria-hidden className="size-3.5 shrink-0" />
        ) : (
          <HashIcon aria-hidden className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{channel.kind === 'dm' ? label : channel.name}</span>
        {channel.muted ? <BellOffIcon aria-label="Muted" className="size-3 shrink-0" /> : null}
        {unread ? (
          <span aria-label={`${channel.unreadCount} unread`} className="rounded-full bg-ring px-1.5 font-mono text-[10.5px] leading-[18px] font-semibold text-white">
            {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-3">
      <div className="flex items-center px-2 pb-1">
        <h3 className="flex-1 font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">{title}</h3>
        {action}
      </div>
      <ul className="grid gap-px">{children}</ul>
    </section>
  );
}

/** Channels and direct messages, with unread counts (v2 #2a). */
export function ChannelList({ channels, activeId, onSelect, onNewChannel, onNewMessage, onBrowse, onSearch }: ChannelListProps) {
  const rooms = (channels ?? []).filter((channel) => channel.kind !== 'dm');
  const dms = (channels ?? []).filter((channel) => channel.kind === 'dm').sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
  return (
    <nav aria-label="Conversations" className="flex h-full w-[248px] shrink-0 flex-col border-r bg-rail max-md:hidden">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <h2 className="flex-1 text-sm font-semibold">Chat</h2>
        <IconButton label="Search messages ( / )" onClick={onSearch}>
          <SearchIcon />
        </IconButton>
        <IconButton label="Browse channels" onClick={onBrowse}>
          <CompassIcon />
        </IconButton>
        <IconButton label="New message" onClick={onNewMessage}>
          <SquarePenIcon />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {channels === undefined ? (
          <div aria-hidden className="grid gap-2 p-2">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-5 w-4/5" />
            ))}
          </div>
        ) : (
          <>
            <Section
              title="Channels"
              action={
                <IconButton label="New channel" onClick={onNewChannel}>
                  <PlusIcon />
                </IconButton>
              }
            >
              {rooms.map((channel) => (
                <Row key={channel.id} channel={channel} active={channel.id === activeId} onSelect={() => onSelect(channel)} />
              ))}
              {rooms.length === 0 ? (
                <li>
                  <button type="button" onClick={onBrowse} className="px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground">
                    Join or create a channel
                  </button>
                </li>
              ) : null}
            </Section>
            <Section title="Direct messages">
              {dms.map((channel) => (
                <Row key={channel.id} channel={channel} active={channel.id === activeId} onSelect={() => onSelect(channel)} />
              ))}
              {dms.length === 0 ? <li className="px-2 py-1 text-xs text-muted-foreground">No direct messages yet</li> : null}
            </Section>
          </>
        )}
      </div>
    </nav>
  );
}
