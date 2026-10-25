export const NOTIFICATION_KINDS = ['task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Entity types a realtime event can refer to; clients map them to the views to refresh. */
export const REALTIME_ENTITY_TYPES = [
  'task',
  'comment',
  'sprint',
  'document',
  'space',
  'list',
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
] as const;
export type RealtimeEntityType = (typeof REALTIME_ENTITY_TYPES)[number];
