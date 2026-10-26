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
  /** Track and log your own time. */
  'time.log',
  /** See everyone's time entries and reports. */
  'time.view_all',
  /** Change or delete anyone's time entries. */
  'time.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** Keeps only known permission keys, e.g. when reading them from an API response. */
export function parsePermissions(values: readonly string[]): Permission[] {
  return values.filter(isPermission);
}

export const PLATFORM_ROLES = ['SUPER_ADMIN', 'USER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const SYSTEM_ROLE_KEYS = ['owner', 'admin', 'member', 'guest'] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

// Built-in roles get their permissions from managed policies (see iam.ts, SYSTEM_ROLE_POLICIES).

export const ROLE_NAME_MAX = 50;
