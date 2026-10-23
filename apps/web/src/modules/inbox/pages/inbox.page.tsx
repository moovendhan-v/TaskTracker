import { CheckCheckIcon, InboxIcon } from 'lucide-react';
import { useState } from 'react';
import type { NotificationResponse } from '@taskflow/shared-types';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationItem } from '../components/notification-item';
import { useInboxMutations, useNotifications } from '../hooks/use-inbox';

/** Your notifications in this workspace, newest first. New ones appear live. */
export function InboxPage({ workspaceId }: { workspaceId: string }) {
  const [unreadOnly, setUnreadOnly] = useState(true);
  const { data, isLoading } = useNotifications(workspaceId, unreadOnly);
  const { markRead, markAllRead } = useInboxMutations(workspaceId);
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
            <Tabs value={unreadOnly ? 'unread' : 'all'} onValueChange={(value) => setUnreadOnly(value === 'unread')}>
              <TabsList>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" disabled={markAllRead.isPending || items.every((n) => n.readAt !== null)} onClick={() => markAllRead.mutate()}>
              <CheckCheckIcon />
              Mark all read
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-3xl p-6">
        {!isLoading && items.length === 0 ? (
          <EmptyState
            icon={<InboxIcon />}
            title={unreadOnly ? 'You’re all caught up' : 'Nothing here yet'}
            description="When someone assigns you a task, comments on yours or decides on your time off, it shows up here."
          />
        ) : (
          <ul aria-label="Notifications" className="grid gap-1">
            {items.map((notification) => (
              <li key={notification.id}>
                <NotificationItem workspaceId={workspaceId} notification={notification} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
