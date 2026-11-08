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
    case 'access_requested':
      return `${who} asked for access: ${notification.subject}${notification.excerpt ? ` (“${notification.excerpt}”)` : ''}`;
    case 'access_decided':
      return `${who} answered your access request: ${notification.subject}`;
    case 'chat_mention':
      return `${who} mentioned you in ${notification.subject || 'chat'}`;
    case 'automation':
      // The automation's own message, already filled in; the excerpt names the automation.
      return notification.subject;
  }
}

/** An access request opens the checker on that person and permission ("task.update in Ops"); an answer, on your own. */
export function accessSearch(notification: Pick<NotificationResponse, 'actorId' | 'subject'>): { user?: string; permission?: string } {
  return { user: notification.actorId ?? undefined, permission: notification.subject.split(' ')[0]?.replace(/:$/, '') || undefined };
}
