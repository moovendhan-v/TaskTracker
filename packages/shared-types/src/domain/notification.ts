export const NOTIFICATION_KINDS = ['task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention', 'access_requested', 'access_decided'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

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
  /** Someone moved or changed state in the virtual office (D3). */
  'office_presence',
] as const;
export type RealtimeEntityType = (typeof REALTIME_ENTITY_TYPES)[number];
