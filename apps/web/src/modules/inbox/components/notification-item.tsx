import { ZapIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { NotificationResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { formatLongDate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { describeNotification } from '../lib/describe-notification';

interface NotificationItemProps {
  workspaceId: string;
  notification: NotificationResponse;
  onOpen: (notification: NotificationResponse) => void;
}

/** One inbox row. Text is rendered as text, never HTML. Opening it marks it read. */
export function NotificationItem({ workspaceId, notification, onOpen }: NotificationItemProps) {
  const unread = notification.readAt === null;
  const className = cn(
    'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted',
    unread && 'bg-accent/40',
  );
  const body = (
    <>
      <UserAvatar name={notification.actorName ?? '?'} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', unread && 'font-medium')}>{describeNotification(notification)}</span>
        {(notification.kind === 'task_commented' || notification.kind === 'chat_mention') && notification.excerpt ? (
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">{notification.excerpt}</span>
        ) : null}
        {notification.kind === 'automation' ? (
          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <ZapIcon className="size-3" /> Automation: {notification.excerpt}
          </span>
        ) : null}
        <span className="mt-0.5 block text-xs text-muted-foreground">{formatLongDate(notification.createdAt)}</span>
      </span>
      {unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
    </>
  );

  const onClick = () => onOpen(notification);
  if (notification.taskId) {
    return (
      <Link to="/w/$workspaceId/t/$taskId" params={{ workspaceId, taskId: notification.taskId }} onClick={onClick} className={className}>
        {body}
      </Link>
    );
  }
  if (notification.kind === 'chat_mention') {
    return (
      <Link to="/w/$workspaceId/chat/m/$messageId" params={{ workspaceId, messageId: notification.entityId }} onClick={onClick} className={className}>
        {body}
      </Link>
    );
  }
  if (notification.kind === 'leave_requested' || notification.kind === 'leave_decided') {
    const to = notification.kind === 'leave_requested' ? '/w/$workspaceId/people/approvals' : '/w/$workspaceId/people/time-off';
    return (
      <Link to={to} params={{ workspaceId }} onClick={onClick} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <Link to="/w/$workspaceId" params={{ workspaceId }} onClick={onClick} className={className}>
      {body}
    </Link>
  );
}
