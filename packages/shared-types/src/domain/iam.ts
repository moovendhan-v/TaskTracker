import { PERMISSIONS, type Permission } from './permissions.js';

/**
 * Access control in the style of cloud IAM: roles get their rights from
 * policies. A policy is a list of statements that allow or deny permissions
 * (actions such as `task.update`) and fields (data such as `member.email`).
 * Deny always wins. Patterns may end in `*`: `task.*`, `member.*`, `*`.
 */

export const POLICY_EFFECTS = ['allow', 'deny'] as const;
export type PolicyEffect = (typeof POLICY_EFFECTS)[number];

export interface PolicyStatement {
  effect: PolicyEffect;
  /** Permission keys or patterns, e.g. `task.*`. */
  permissions?: string[] | null;
  /** Field keys or patterns, e.g. `member.email`. Controls whether the field is readable. */
  fields?: string[] | null;
}

export interface PolicyDocument {
  statements: PolicyStatement[];
}

export const POLICY_LIMITS = { maxStatements: 50, maxEntriesPerStatement: 50, nameMax: 80, descriptionMax: 300 } as const;

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
}

/** Evaluates policies the IAM way: anything allowed by some statement and denied by none. */
export function evaluatePolicies(documents: readonly PolicyDocument[]): EffectiveAccess {
  const statements = documents.flatMap((document) => document.statements);
  const matches = (effect: PolicyEffect, kind: 'permissions' | 'fields', key: string) =>
    statements.some((statement) => statement.effect === effect && (statement[kind] ?? []).some((pattern) => matchesPattern(pattern, key)));

  const permissions = PERMISSIONS.filter((permission) => matches('allow', 'permissions', permission) && !matches('deny', 'permissions', permission));
  const fieldKeys = PROTECTED_FIELDS.map((field) => field.key);
  return {
    permissions,
    allowedFields: fieldKeys.filter((key) => matches('allow', 'fields', key)),
    deniedFields: fieldKeys.filter((key) => matches('deny', 'fields', key)),
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
