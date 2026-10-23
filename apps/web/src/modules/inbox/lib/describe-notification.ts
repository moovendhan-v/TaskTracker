import type { NotificationResponse } from '@taskflow/shared-types';

type Describable = Pick<NotificationResponse, 'kind' | 'actorName' | 'subject' | 'excerpt'>;

/** One plain-text line for a notification, e.g. "Jordan Patel assigned you “Fix login”". */
export function describeNotification(notification: Describable): string {
  const who = notification.actorName ?? 'Someone';
  const subject = notification.subject ? `“${notification.subject}”` : 'a task';
  switch (notification.kind) {
    case 'task_assigned':
      return `${who} assigned you ${subject}`;
    case 'task_commented':
      return `${who} commented on ${subject}`;
    case 'leave_requested':
      return `${who} asked for time off: ${notification.subject}`;
    case 'leave_decided':
      return `${who} ${notification.excerpt === 'rejected' ? 'declined' : 'approved'} your time off: ${notification.subject}`;
    case 'member_added':
      return `${who} added you to this workspace${notification.subject ? ` as ${notification.subject}` : ''}`;
  }
}
