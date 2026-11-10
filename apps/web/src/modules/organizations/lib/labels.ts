import type { OrgRole, TwoStepRequirement } from '@taskflow/shared-types';

export const ROLE_LABEL: Record<OrgRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
export const TWO_STEP_LABEL: Record<TwoStepRequirement, string> = { off: 'Not required', admins: 'People with admin rights', everyone: 'Everyone' };

/** Organization activity as a sentence. */
export function describeActivity(action: string, metadata: Record<string, unknown>): string {
  switch (action) {
    case 'organization.create':
      return 'created the organization';
    case 'organization.rename':
      return `renamed it to ${String(metadata['to'] ?? '')}`;
    case 'organization.two_step.update':
      return `set two-step sign-in to “${TWO_STEP_LABEL[(metadata['to'] as TwoStepRequirement) ?? 'off'] ?? String(metadata['to'])}”`;
    case 'organization.member.add':
      return `added someone as ${String(metadata['role'] ?? 'member')}`;
    case 'organization.member.role':
      return `changed someone’s role to ${String(metadata['to'] ?? '')}`;
    case 'organization.member.remove':
      return 'removed someone';
    case 'organization.member.leave':
      return 'left';
    case 'organization.workspace.add':
      return 'added a workspace';
    case 'organization.workspace.remove':
      return 'took a workspace out';
    case 'organization.sso.set':
      return `set up single sign-on for ${String(metadata['domain'] ?? '')}`;
    case 'organization.sso.verify':
      return `verified ${String(metadata['domain'] ?? '')} for single sign-on`;
    case 'organization.sso.remove':
      return 'removed single sign-on';
    case 'organization.delete':
      return 'deleted the organization';
    default:
      return action;
  }
}
