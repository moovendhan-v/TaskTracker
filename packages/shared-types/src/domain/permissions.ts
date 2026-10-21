export const PERMISSIONS = [
  'workspace.manage',
  'members.manage',
  'roles.manage',
  'space.manage',
  'list.manage',
  'task.view',
  'task.create',
  'task.update',
  'task.delete',
  'task.assign',
  'sprint.manage',
  'doc.view',
  'doc.create',
  'doc.manage',
  'hr.view',
  'hr.manage',
  'leave.request',
  'leave.approve',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PLATFORM_ROLES = ['SUPER_ADMIN', 'USER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const SYSTEM_ROLE_KEYS = ['owner', 'admin', 'member', 'guest'] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

const MEMBER_PERMISSIONS: readonly Permission[] = [
  'task.view',
  'task.create',
  'task.update',
  'task.assign',
  'doc.view',
  'doc.create',
  'hr.view',
  'leave.request',
];

/** Permissions seeded for the built-in roles of every new workspace. */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleKey, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== 'workspace.manage'),
  member: MEMBER_PERMISSIONS,
  guest: ['task.view', 'doc.view'],
};

export const ROLE_NAME_MAX = 50;
