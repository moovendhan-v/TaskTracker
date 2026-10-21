export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles allowed to change workspace structure (spaces, lists, settings). */
export const WORKSPACE_MANAGER_ROLES: readonly WorkspaceRole[] = ['owner', 'admin'];

export const NAME_MAX = 80;
export const COLOR_PATTERN = '^#[0-9a-fA-F]{6}$';
