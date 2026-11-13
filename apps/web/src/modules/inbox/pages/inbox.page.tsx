import { AlarmClockIcon, CheckCheckIcon, InboxIcon, Undo2Icon } from 'lucide-react';
import { useState } from 'react';
import { INBOX_FILTERS, type InboxFilterKey, type NotificationResponse } from '@taskflow/shared-types';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { formatDayAndTime } from '@/lib/dates';
import { snoozeOptions } from '../lib/snooze';
import { NotificationItem } from '../components/notification-item';
import { useInboxMutations, useNotifications } from '../hooks/use-inbox';

type InboxTab = 'unread' | 'all' | 'snoozed';

const FILTER_LABELS: Record<InboxFilterKey, string> = {
  mentions: 'Mentions',
  assigned: 'Assigned',
  comments: 'Comments',
  time_off: 'Time off',
  access: 'Access',
  automations: 'Automations',
};

/**
 * Your notifications in this workspace, newest first. New ones appear live. Filter by kind;
 * snooze one until later (it comes back unread), and see what's snoozed in its own tab.
 */
export function InboxPage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<InboxTab>('unread');
  const [filter, setFilter] = useState<InboxFilterKey | null>(null);
  const unreadOnly = tab === 'unread';
  const { data, isLoading } = useNotifications(workspaceId, { unreadOnly, snoozed: tab === 'snoozed', kinds: filter ? INBOX_FILTERS[filter] : null });
  const { markRead, markAllRead, snooze } = useInboxMutations(workspaceId);
  const items = data?.items ?? [];

  const open = (notification: NotificationResponse) => {
    if (notification.readAt === null) markRead.mutate([notification.id]);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Inbox"
        description="Assignments, comments on your tasks, time off and invitations."
        icon={<InboxIcon className="size-5 text-muted-foreground" />}
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={tab} onValueChange={(value) => setTab(value as InboxTab)}>
              <TabsList>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="snoozed">Snoozed</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" disabled={markAllRead.isPending || items.every((n) => n.readAt !== null)} onClick={() => markAllRead.mutate()}>
              <CheckCheckIcon />
              Mark all read
            </Button>
          </div>
        }
      />
      <div className="mx-auto grid max-w-3xl gap-3 p-4 md:p-6">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {([null, ...(Object.keys(FILTER_LABELS) as InboxFilterKey[])] as const).map((key) => (
            <button
              key={key ?? 'all'}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                filter === key ? 'border-transparent bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {key ? FILTER_LABELS[key] : 'Everything'}
            </button>
          ))}
        </div>
        {!isLoading && items.length === 0 ? (
          <EmptyState
            icon={tab === 'snoozed' ? <AlarmClockIcon /> : <InboxIcon />}
            title={tab === 'snoozed' ? 'Nothing snoozed' : unreadOnly ? 'You’re all caught up' : 'Nothing here yet'}
            description={
              tab === 'snoozed'
                ? 'Snooze something to deal with it later: it comes back here, unread, when you chose.'
                : 'When someone assigns you a task, mentions you, comments on yours or decides on your time off, it shows up here.'
            }
          />
        ) : (
          <ul aria-label="Notifications" className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {items.map((notification) => (
              <li key={notification.id} className="group/row relative">
                <NotificationItem workspaceId={workspaceId} notification={notification} onOpen={open} />
                <div className="absolute top-2.5 right-2 flex items-center gap-1 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100">
                  {tab === 'snoozed' ? (
                    <>
                      {notification.snoozedUntil ? <span className="rounded-md bg-background px-1.5 text-xs text-muted-foreground">Back {formatDayAndTime(notification.snoozedUntil)}</span> : null}
                      <Button size="sm" variant="outline" className="h-7 bg-background" onClick={() => snooze.mutate({ ids: [notification.id], until: null })}>
                        <Undo2Icon /> Unsnooze
                      </Button>
                    </>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="outline" className="bg-background" aria-label={`Snooze: ${notification.subject || 'this notification'}`}>
                          <AlarmClockIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Snooze until</DropdownMenuLabel>
                        {snoozeOptions(new Date()).map((option) => (
                          <DropdownMenuItem key={option.label} onSelect={() => snooze.mutate({ ids: [notification.id], until: option.until })}>
                            {option.label}
                            <span className="ml-auto pl-3 text-xs text-muted-foreground">{formatDayAndTime(option.until.toISOString())}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
