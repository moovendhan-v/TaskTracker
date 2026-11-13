export const NOTIFICATION_KINDS = ['task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention', 'access_requested', 'access_decided', 'comment_mention'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** How far ahead an inbox item can be snoozed. */
export const SNOOZE_MAX_DAYS = 30;

/** The inbox's filters, by the kinds each one shows. */
export const INBOX_FILTERS = {
  mentions: ['chat_mention', 'comment_mention'],
  assigned: ['task_assigned'],
  comments: ['task_commented'],
  time_off: ['leave_requested', 'leave_decided'],
  access: ['access_requested', 'access_decided'],
  automations: ['automation'],
} as const satisfies Record<string, readonly NotificationKind[]>;
export type InboxFilterKey = keyof typeof INBOX_FILTERS;

/** Entity types a realtime event can refer to; clients map them to the views to refresh. */
export const REALTIME_ENTITY_TYPES = [
  'task',
  'comment',
  'sprint',
  'document',
  'space',
  'list',
  'folder',
  'member',
  'leave_request',
  'notification',
  'role',
  'workspace',
  'department',
  'employee',
  'leave_type',
  'policy',
  'status',
  'custom_field',
  'time_entry',
  'automation',
  'integration',
  'chat_channel',
  'chat_message',
  /** Someone is typing in a channel: a live signal only, never stored. */
  'chat_typing',
  'task_attachment',
  /** A task's checklist changed (entity id: the task). */
  'task_checklist',
  /** Someone moved or changed state in the virtual office (D3). */
  'office_presence',
] as const;
export type RealtimeEntityType = (typeof REALTIME_ENTITY_TYPES)[number];
