import { PERMISSIONS, type Permission } from './permissions.js';

/**
 * Access control in the style of cloud IAM: roles get their rights from
 * policies. A policy is a list of statements that allow or deny permissions
 * (actions such as `task.update`) and fields (data such as `member.email`).
 * Deny always wins. Patterns may end in `*`: `task.*`, `member.*`, `*`.
 *
 * A deny statement can be limited to some spaces (projects) with `spaces`, or
 * to every space except some with `notSpaces`, like an IAM resource condition:
 * `{ effect: 'deny', permissions: ['*'], spaces: [hrSpaceId] }` hides that
 * space, `{ effect: 'deny', permissions: ['task.update'], notSpaces: [mine] }`
 * makes every other space read-only. A space whose `task.view` is denied is
 * hidden entirely: the database doesn't return its rows.
 */

export const POLICY_EFFECTS = ['allow', 'deny'] as const;
export type PolicyEffect = (typeof POLICY_EFFECTS)[number];

export interface PolicyStatement {
  effect: PolicyEffect;
  /** Permission keys or patterns, e.g. `task.*`. */
  permissions?: string[] | null;
  /** Field keys or patterns, e.g. `member.email`. Controls whether the field is readable. */
  fields?: string[] | null;
  /** Deny only: limit the statement to these space ids. */
  spaces?: string[] | null;
  /** Deny only: apply the statement in every space except these. */
  notSpaces?: string[] | null;
}

/** Permissions that act on things inside one space, so a statement may target spaces. */
export const SPACE_SCOPED_PERMISSIONS = [
  'space.manage',
  'list.manage',
  'task.view',
  'task.create',
  'task.update',
  'task.delete',
  'task.assign',
  'sprint.manage',
  'automation.manage',
  'doc.view',
  'doc.create',
  'doc.manage',
] as const satisfies readonly Permission[];
export type SpaceScopedPermission = (typeof SPACE_SCOPED_PERMISSIONS)[number];

/** One space-limited deny: these permissions are taken away in `spaces`, or everywhere but `notSpaces`. */
export interface SpaceRule {
  spaces: string[] | null;
  notSpaces: string[] | null;
  permissions: SpaceScopedPermission[];
}

/** Space ids a rule applies to, for the database: `deny` lists, `only` limits (null: no limit). */
export interface SpaceVisibility {
  deny: string[];
  only: string[] | null;
}

export interface PolicyDocument {
  statements: PolicyStatement[];
}

export const POLICY_LIMITS = { maxStatements: 50, maxEntriesPerStatement: 50, nameMax: 80, descriptionMax: 300, maxSpacesPerStatement: 100 } as const;

/** Data fields whose visibility policies control. Hidden ones need an explicit allow. */
export interface FieldDefinition {
  key: string;
  label: string;
  description: string;
  /** Visible unless denied (true), or hidden unless allowed (false). */
  visibleByDefault: boolean;
}

export const PROTECTED_FIELDS: readonly FieldDefinition[] = [
  { key: 'member.email', label: 'Member email', description: "Members' email addresses in member lists and tables", visibleByDefault: false },
  { key: 'task.metadata', label: 'Task metadata', description: 'Key/value data on tasks, e.g. ids from other systems', visibleByDefault: true },
  { key: 'employee.startDate', label: 'Employee start date', description: 'When someone joined, in the people directory', visibleByDefault: true },
  { key: 'employee.employmentType', label: 'Employment type', description: 'Full-time, part-time, contractor…', visibleByDefault: true },
  { key: 'audit.metadata', label: 'Audit details', description: 'Extra details recorded with audit entries', visibleByDefault: true },
];
export type FieldKey = (typeof PROTECTED_FIELDS)[number]['key'];

const FIELD_DEFAULTS = new Map(PROTECTED_FIELDS.map((field) => [field.key, field.visibleByDefault]));

export interface ManagedPolicy {
  key: string;
  name: string;
  description: string;
  document: PolicyDocument;
}

/** Ready-made policies. They live in code, so every workspace gets fixes and new permissions at once. */
export const MANAGED_POLICIES: readonly ManagedPolicy[] = [
  {
    key: 'FullAccess',
    name: 'Full access',
    description: 'Everything, including deleting the workspace. Meant for owners.',
    document: { statements: [{ effect: 'allow', permissions: ['*'], fields: ['*'] }] },
  },
  {
    key: 'WorkspaceAdmin',
    name: 'Workspace admin',
    description: 'Manage members, roles, spaces and all work, and see member emails. Everything except deleting the workspace.',
    document: {
      statements: [
        { effect: 'allow', permissions: ['*'], fields: ['*'] },
        { effect: 'deny', permissions: ['workspace.manage'] },
      ],
    },
  },
  {
    key: 'Contributor',
    name: 'Contributor',
    description: 'Create and update tasks and docs, log their own time, request time off and see the people directory.',
    document: {
      statements: [{ effect: 'allow', permissions: ['task.view', 'task.create', 'task.update', 'task.assign', 'doc.view', 'doc.create', 'hr.view', 'leave.request', 'time.log'] }],
    },
  },
  {
    key: 'ReadOnly',
    name: 'Read only',
    description: 'See tasks and docs, change nothing.',
    document: { statements: [{ effect: 'allow', permissions: ['task.view', 'doc.view'] }] },
  },
  {
    key: 'SprintPlanner',
    name: 'Sprint planner',
    description: 'Plan sprints and manage every task.',
    document: { statements: [{ effect: 'allow', permissions: ['sprint.manage', 'task.*', 'list.manage'] }] },
  },
  {
    key: 'TimeManager',
    name: 'Time manager',
    description: "See everyone's time and timesheets, and correct anyone's entries.",
    document: { statements: [{ effect: 'allow', permissions: ['time.*', 'task.view'] }] },
  },
  {
    key: 'PeopleManager',
    name: 'People manager',
    description: 'Run HR: the directory, departments, leave types and approvals. Sees member emails.',
    document: { statements: [{ effect: 'allow', permissions: ['hr.*', 'leave.*'], fields: ['member.email', 'employee.*'] }] },
  },
  {
    key: 'Auditor',
    name: 'Auditor',
    description: 'Read the audit log, tasks and docs.',
    document: { statements: [{ effect: 'allow', permissions: ['audit.view', 'task.view', 'doc.view'], fields: ['audit.*'] }] },
  },
  {
    key: 'HideMemberEmails',
    name: 'Hide member emails',
    description: 'Never show member emails, whatever other policies allow.',
    document: { statements: [{ effect: 'deny', fields: ['member.email'] }] },
  },
];

export const MANAGED_POLICY_KEYS = MANAGED_POLICIES.map((policy) => policy.key);

/** The managed policy each built-in role starts with. */
export const SYSTEM_ROLE_POLICIES = { owner: 'FullAccess', admin: 'WorkspaceAdmin', member: 'Contributor', guest: 'ReadOnly' } as const;

export function matchesPattern(pattern: string, key: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return key.startsWith(pattern.slice(0, -1));
  return pattern === key;
}

/** What a set of policies adds up to. */
export interface EffectiveAccess {
  permissions: Permission[];
  /** Field keys explicitly allowed and denied (patterns expanded to the known fields). */
  allowedFields: string[];
  deniedFields: string[];
  /** Space-limited denies, on top of `permissions`. */
  spaceRules: SpaceRule[];
}

/** Evaluates policies the IAM way: anything allowed by some statement and denied by none. */
export function evaluatePolicies(documents: readonly PolicyDocument[]): EffectiveAccess {
  const all = documents.flatMap((document) => document.statements);
  const statements = all.filter((statement) => !isSpaceLimited(statement));
  const matches = (effect: PolicyEffect, kind: 'permissions' | 'fields', key: string) =>
    statements.some((statement) => statement.effect === effect && (statement[kind] ?? []).some((pattern) => matchesPattern(pattern, key)));

  const permissions = PERMISSIONS.filter((permission) => matches('allow', 'permissions', permission) && !matches('deny', 'permissions', permission));
  const fieldKeys = PROTECTED_FIELDS.map((field) => field.key);
  return {
    permissions,
    allowedFields: fieldKeys.filter((key) => matches('allow', 'fields', key)),
    deniedFields: fieldKeys.filter((key) => matches('deny', 'fields', key)),
    spaceRules: all.filter(isSpaceLimited).flatMap((statement) => {
      const scoped = SPACE_SCOPED_PERMISSIONS.filter((permission) => (statement.permissions ?? []).some((pattern) => matchesPattern(pattern, permission)));
      if (statement.effect !== 'deny' || scoped.length === 0) return [];
      return [{ spaces: statement.spaces?.length ? [...statement.spaces] : null, notSpaces: statement.notSpaces?.length ? [...statement.notSpaces] : null, permissions: scoped }];
    }),
  };
}

/** Whether a field is readable under some effective access: deny wins, then an allow, then the field's default. */
export function canReadField(access: { allowedFields: readonly string[]; deniedFields: readonly string[] }, key: string): boolean {
  if (access.deniedFields.includes(key)) return false;
  if (access.allowedFields.includes(key)) return true;
  return FIELD_DEFAULTS.get(key) ?? true;
}

/** Permission keys a pattern list grants, e.g. for checking that someone may hand them out. */
export function expandPermissions(patterns: readonly string[]): Permission[] {
  return PERMISSIONS.filter((permission) => patterns.some((pattern) => matchesPattern(pattern, permission)));
}

/** Patterns that match nothing known are mistakes; the API rejects them. */
export function isKnownPermissionPattern(pattern: string): boolean {
  return expandPermissions([pattern]).length > 0;
}

export function isKnownFieldPattern(pattern: string): boolean {
  return PROTECTED_FIELDS.some((field) => matchesPattern(pattern, field.key));
}

export function isSpaceLimited(statement: Pick<PolicyStatement, 'spaces' | 'notSpaces'>): boolean {
  return Boolean(statement.spaces?.length || statement.notSpaces?.length);
}

function ruleCovers(rule: SpaceRule, spaceId: string): boolean {
  if (rule.spaces) return rule.spaces.includes(spaceId);
  if (rule.notSpaces) return !rule.notSpaces.includes(spaceId);
  return false;
}

/**
 * Whether a permission holds inside one space: granted workspace-wide and not
 * taken away there by a space rule.
 */
export function canInSpace(access: { permissions: Iterable<Permission>; spaceRules: readonly SpaceRule[] }, spaceId: string, permission: Permission): boolean {
  return [...access.permissions].includes(permission) && !deniedInSpace(access.spaceRules, spaceId, permission);
}

/** Whether a space rule takes `permission` away inside `spaceId`. */
export function deniedInSpace(rules: readonly SpaceRule[], spaceId: string, permission: Permission): boolean {
  return rules.some((rule) => (rule.permissions as readonly string[]).includes(permission) && ruleCovers(rule, spaceId));
}

/**
 * Which spaces a permission is denied in, in the form row-level security uses:
 * spaces listed by some rule, and (for `notSpaces` rules) the only spaces left.
 */
export function spaceVisibility(rules: readonly SpaceRule[], permission: SpaceScopedPermission): SpaceVisibility {
  const relevant = rules.filter((rule) => rule.permissions.includes(permission));
  const deny = [...new Set(relevant.flatMap((rule) => rule.spaces ?? []))].sort();
  const limits = relevant.flatMap((rule) => (rule.notSpaces ? [rule.notSpaces] : []));
  const only = limits.length === 0 ? null : limits.reduce((kept, list) => kept.filter((id) => list.includes(id))).sort();
  return { deny, only };
}

/**
 * Whether `result` is at least as limited in spaces as `actor`: wherever the
 * actor is denied something by a space rule, the result is denied it too (or
 * doesn't have it at all). Stops someone who can't see a space from building
 * or handing out a role that can.
 */
export function keepsSpaceRules(
  actor: { spaceRules: readonly SpaceRule[] },
  result: { permissions: readonly Permission[]; spaceRules: readonly SpaceRule[] },
): boolean {
  return actor.spaceRules.every((rule) =>
    rule.permissions.every((permission) => {
      if (!result.permissions.includes(permission)) return true;
      if (rule.spaces) return rule.spaces.every((spaceId) => !canInSpace(result, spaceId, permission));
      // "Everywhere except E": the result needs a rule of its own that excepts no more than E.
      const except = rule.notSpaces ?? [];
      return result.spaceRules.some((own) => own.permissions.includes(permission) && own.notSpaces !== null && own.notSpaces.every((id) => except.includes(id)));
    }),
  );
}

export function isSpaceScoped(permission: string): permission is SpaceScopedPermission {
  return (SPACE_SCOPED_PERMISSIONS as readonly string[]).includes(permission);
}

/** Space rules from an API response, keeping only permission keys that apply in a space. */
export function parseSpaceRules(rules: readonly { spaces: string[] | null; notSpaces: string[] | null; permissions: readonly string[] }[]): SpaceRule[] {
  return rules.map((rule) => ({ spaces: rule.spaces, notSpaces: rule.notSpaces, permissions: rule.permissions.filter(isSpaceScoped) }));
}
