import { useNavigate } from '@tanstack/react-router';
import type { NotificationResponse } from '@taskflow/shared-types';
import { CheckCheckIcon, ExternalLinkIcon, InboxIcon, XIcon, ZapIcon } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Segmented } from '@/components/kit/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { dayGroup, timeAgo, type DayGroup } from '@/lib/relative-time';
import { useInboxMutations, useNotifications } from '../hooks/use-inbox';
import { describeNotification } from '../lib/describe-notification';
import { useInboxPanel } from '../store/inbox-panel.store';

const GROUPS: DayGroup[] = ['Today', 'Yesterday', 'Earlier'];

interface InboxPanelProps {
  workspaceId: string;
  /** Opens a task over the current page, so reading the inbox never loses your place. */
  onOpenTask: (taskId: string) => void;
}

/**
 * The inbox docked at the side of the workbench (v2 #1a side panel). Task notifications
 * open the task over the page you're on; time-off ones go to their page.
 */
export function InboxPanel({ workspaceId, onOpenTask }: InboxPanelProps) {
  const { open, setOpen } = useInboxPanel();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const { data, isPending } = useNotifications(workspaceId, filter === 'unread');
  const { markRead, markAllRead } = useInboxMutations(workspaceId);
  if (!open) return null;

  const items = data?.items ?? [];
  const select = (notification: NotificationResponse) => {
    if (notification.readAt === null) markRead.mutate([notification.id]);
    if (notification.taskId) onOpenTask(notification.taskId);
    else if (notification.kind === 'leave_requested') void navigate({ to: '/w/$workspaceId/people/approvals', params: { workspaceId } });
    else if (notification.kind === 'chat_mention') void navigate({ to: '/w/$workspaceId/chat/m/$messageId', params: { workspaceId, messageId: notification.entityId } });
    else if (notification.kind === 'leave_decided') void navigate({ to: '/w/$workspaceId/people/time-off', params: { workspaceId } });
  };
  const close = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <aside
      aria-label="Inbox"
      onKeyDown={close}
      className="flex h-full w-[340px] shrink-0 flex-col border-l bg-rail max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-popover"
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <h2 className="text-sm font-semibold">Inbox</h2>
        <div className="flex-1" />
        <Tooltip label="Mark all read" side="bottom">
          <button
            type="button"
            aria-label="Mark all read"
            disabled={markAllRead.isPending || !items.some((item) => item.readAt === null)}
            onClick={() => markAllRead.mutate()}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
          >
            <CheckCheckIcon className="size-4" />
          </button>
        </Tooltip>
        <Tooltip label="Open the full inbox · G I" side="bottom">
          <button
            type="button"
            aria-label="Open the full inbox"
            onClick={() => {
              setOpen(false);
              void navigate({ to: '/w/$workspaceId/inbox', params: { workspaceId } });
            }}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ExternalLinkIcon className="size-4" />
          </button>
        </Tooltip>
        <button
          type="button"
          aria-label="Close inbox"
          onClick={() => setOpen(false)}
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <XIcon className="size-4" />
        </button>
      </header>
      <div className="border-b px-3 py-2">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'unread', label: 'Unread' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <div aria-hidden className="grid gap-3 p-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-2.5">
                <Skeleton className="size-7 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center gap-2 px-6 py-12 text-center">
            <InboxIcon className="size-6 text-subtle-foreground" />
            <p className="text-sm font-medium">{filter === 'unread' ? 'You’re all caught up' : 'Nothing here yet'}</p>
            <p className="text-xs text-muted-foreground">Assignments, comments on your tasks and time-off decisions show up here.</p>
          </div>
        ) : (
          GROUPS.map((group) => {
            const rows = items.filter((item) => dayGroup(item.createdAt) === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-label={group}>
                <h3 className="px-3 pt-3 pb-1 font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">{group}</h3>
                <ul>
                  {rows.map((notification) => {
                    const unread = notification.readAt === null;
                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => select(notification)}
                          className={cn(
                            'flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                            unread && 'bg-primary-soft/50',
                          )}
                        >
                          {notification.actorName ? (
                            <UserAvatar name={notification.actorName} className="size-7 shrink-0 text-[10px]" />
                          ) : (
                            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                              <ZapIcon className="size-3.5" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-[13px] leading-snug', unread && 'font-medium')}>{describeNotification(notification)}</span>
                            {(notification.kind === 'task_commented' || notification.kind === 'chat_mention') && notification.excerpt ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">“{notification.excerpt}”</span>
                            ) : null}
                            {notification.kind === 'automation' ? (
                              <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <ZapIcon className="size-3" aria-hidden /> {notification.excerpt}
                              </span>
                            ) : null}
                            <span className="mt-0.5 block font-mono text-[11px] text-subtle-foreground">{timeAgo(notification.createdAt)}</span>
                          </span>
                          {unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ring" aria-label="Unread" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}
