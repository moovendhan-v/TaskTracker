import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  canManageOrg,
  ORG_NAME_MAX,
  type OrganizationActivityResponse,
  type OrganizationMemberResponse,
  type OrganizationResponse,
  type OrganizationWorkspaceResponse,
  type OrgRole,
  type TwoStepRequirement,
} from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { entityTag } from '../../../core/cache/cache-keys.js';
import { CacheStore } from '../../../core/cache/cache-store.port.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { OrganizationRepository, type OrganizationRecord } from '../domain/organization.repository.js';

const ACTIVITY_LIMIT = 100;

/**
 * Organizations above workspaces (A3). Membership is checked first from your own
 * membership row (readable in the user scope); only then does the work run in that
 * organization's row-level security scope. Owners and admins run it; only owners make
 * or remove owners and delete it, and an organization always keeps an owner. Every
 * change is in the organization's activity log.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly transactional: TransactionalManager,
    private readonly accessService: AccessService,
    private readonly audit: AuditLogger,
    private readonly cache: CacheStore,
  ) {}

  async listMine(userId: string): Promise<OrganizationResponse[]> {
    return (await this.organizations.listMine(userId)).map((record) => toResponse(record, record.role));
  }

  async create(actor: Actor, name: string): Promise<OrganizationResponse> {
    const id = randomUUID();
    const clean = validName(name);
    return this.inOrg(id, actor.userId, async () => {
      await this.organizations.create({ id, name: clean, createdBy: actor.userId });
      await this.record(actor, id, 'organization.create', { name: clean });
      return toResponse(await this.found(id), 'owner');
    });
  }

  async get(actor: Actor, organizationId: string): Promise<OrganizationResponse> {
    const role = await this.role(actor, organizationId);
    return this.inOrg(organizationId, actor.userId, async () => toResponse(await this.found(organizationId), role));
  }

  async members(actor: Actor, organizationId: string): Promise<OrganizationMemberResponse[]> {
    await this.role(actor, organizationId);
    return this.inOrg(organizationId, actor.userId, () => this.organizations.members(organizationId));
  }

  async workspaces(actor: Actor, organizationId: string): Promise<OrganizationWorkspaceResponse[]> {
    await this.role(actor, organizationId);
    return this.inOrg(organizationId, actor.userId, () => this.organizations.workspaces(organizationId));
  }

  async activity(actor: Actor, organizationId: string): Promise<OrganizationActivityResponse[]> {
    await this.role(actor, organizationId, 'manage');
    return this.inOrg(organizationId, actor.userId, () => this.organizations.activity(organizationId, ACTIVITY_LIMIT));
  }

  async rename(actor: Actor, organizationId: string, name: string): Promise<OrganizationResponse> {
    const role = await this.role(actor, organizationId, 'manage');
    const clean = validName(name);
    return this.inOrg(organizationId, actor.userId, async () => {
      const before = await this.found(organizationId);
      await this.organizations.rename(organizationId, clean);
      await this.record(actor, organizationId, 'organization.rename', { from: before.name, to: clean });
      return toResponse(await this.found(organizationId), role);
    });
  }

  /**
   * Requires two-step sign-in in every workspace of the organization (on top of each
   * workspace's own rule). As for a workspace, you need it yourself to require it.
   */
  async setTwoStep(actor: Actor, organizationId: string, requirement: TwoStepRequirement): Promise<OrganizationResponse> {
    const role = await this.role(actor, organizationId, 'manage');
    if (requirement !== 'off' && !(await this.accessService.hasTwoStep(actor.userId))) {
      throw DomainError.forbidden('Set up two-step sign-in for yourself first (Security), so this can never lock you out');
    }
    const result = await this.inOrg(organizationId, actor.userId, async () => {
      const before = await this.found(organizationId);
      await this.organizations.setTwoStep(organizationId, requirement);
      await this.record(actor, organizationId, 'organization.two_step.update', { from: before.twoStepRequired, to: requirement });
      return { response: toResponse(await this.found(organizationId), role), workspaces: await this.organizations.workspaces(organizationId) };
    });
    // Access in each of its workspaces changes at once.
    await this.cache.invalidateTags(result.workspaces.map((workspace) => entityTag(workspace.id, 'access')));
    return result.response;
  }

  async delete(actor: Actor, organizationId: string): Promise<boolean> {
    await this.role(actor, organizationId, 'owner');
    const workspaces = await this.inOrg(organizationId, actor.userId, async () => {
      const organization = await this.found(organizationId);
      const inside = await this.organizations.workspaces(organizationId);
      await this.record(actor, organizationId, 'organization.delete', { name: organization.name, workspaces: inside.length });
      // Its workspaces stay, on their own (ON DELETE SET NULL).
      await this.organizations.delete(organizationId);
      return inside;
    });
    await this.cache.invalidateTags(workspaces.map((workspace) => entityTag(workspace.id, 'access')));
    return true;
  }

  /** Adds someone who has signed up (and confirmed their email) by email. Only owners add owners. */
  async addMember(actor: Actor, organizationId: string, email: string, role: OrgRole): Promise<OrganizationMemberResponse[]> {
    const mine = await this.role(actor, organizationId, 'manage');
    if (role === 'owner' && mine !== 'owner') throw DomainError.forbidden('Only owners can add owners');
    return this.inOrg(organizationId, actor.userId, async () => {
      const user = await this.organizations.findUserByEmail(email.trim());
      // The same answer for unknown and unconfirmed addresses, so this can't be used to find accounts.
      if (!user?.emailVerified) throw DomainError.invalid('No one with a confirmed account uses that email');
      if (!(await this.organizations.addMember(organizationId, user.id, role))) throw DomainError.conflict(`${user.name} is already in the organization`);
      await this.record(actor, organizationId, 'organization.member.add', { userId: user.id, role });
      return this.organizations.members(organizationId);
    });
  }

  async setRole(actor: Actor, organizationId: string, userId: string, role: OrgRole): Promise<OrganizationMemberResponse[]> {
    const mine = await this.role(actor, organizationId, 'manage');
    return this.inOrg(organizationId, actor.userId, async () => {
      const members = await this.organizations.members(organizationId);
      const target = members.find((member) => member.userId === userId);
      if (!target) throw DomainError.notFound('Member');
      if ((target.role === 'owner' || role === 'owner') && mine !== 'owner') throw DomainError.forbidden('Only owners can make or change owners');
      if (target.role === 'owner' && role !== 'owner' && (await this.organizations.ownerCount(organizationId)) <= 1) {
        throw DomainError.conflict('An organization needs an owner: make someone else owner first');
      }
      await this.organizations.setRole(organizationId, userId, role);
      await this.record(actor, organizationId, 'organization.member.role', { userId, from: target.role, to: role });
      return this.organizations.members(organizationId);
    });
  }

  /** Owners and admins remove people; anyone can leave. Owners are removed only by owners. */
  async removeMember(actor: Actor, organizationId: string, userId: string): Promise<OrganizationMemberResponse[]> {
    const mine = await this.role(actor, organizationId, userId === actor.userId ? 'member' : 'manage');
    return this.inOrg(organizationId, actor.userId, async () => {
      const members = await this.organizations.members(organizationId);
      const target = members.find((member) => member.userId === userId);
      if (!target) throw DomainError.notFound('Member');
      if (target.role === 'owner' && mine !== 'owner') throw DomainError.forbidden('Only owners can remove owners');
      if (target.role === 'owner' && (await this.organizations.ownerCount(organizationId)) <= 1) {
        throw DomainError.conflict('An organization needs an owner: make someone else owner first');
      }
      await this.record(actor, organizationId, userId === actor.userId ? 'organization.member.leave' : 'organization.member.remove', { userId });
      await this.organizations.removeMember(organizationId, userId);
      return userId === actor.userId ? [] : this.organizations.members(organizationId);
    });
  }

  /** The organization a workspace is in (workspace scope), for its settings page. */
  async ofWorkspace(access: WorkspaceAccess): Promise<{ id: string; name: string; twoStepRequired: TwoStepRequirement } | null> {
    return this.organizations.workspaceOrganization(access.workspaceId);
  }

  /**
   * Puts a workspace in an organization: you manage the workspace (checked by the resolver)
   * and are an owner or admin of the organization (checked here and by a database trigger).
   */
  @Announces('workspace.updated', workspaceFromAccess)
  async attachWorkspace(actor: Actor, access: WorkspaceAccess, organizationId: string): Promise<{ id: string; workspaceId: string }> {
    const role = await this.organizations.myRole(organizationId, actor.userId);
    if (!canManageOrg(role)) throw DomainError.forbidden('Only owners and admins of the organization can add workspaces to it');
    const current = await this.organizations.workspaceOrganization(access.workspaceId);
    if (current?.id === organizationId) return { id: access.workspaceId, workspaceId: access.workspaceId };
    if (current) throw DomainError.conflict(`This workspace is in ${current.name}; take it out first`);
    await this.organizations.setWorkspaceOrganization(access.workspaceId, organizationId);
    await this.audit.record(actor, {
      action: 'organization.workspace.add',
      targetType: 'workspace',
      targetId: access.workspaceId,
      workspaceId: access.workspaceId,
      organizationId,
    });
    return { id: access.workspaceId, workspaceId: access.workspaceId };
  }

  @Announces('workspace.updated', workspaceFromAccess)
  async detachWorkspace(actor: Actor, access: WorkspaceAccess): Promise<{ id: string; workspaceId: string }> {
    const current = await this.organizations.workspaceOrganization(access.workspaceId);
    if (current) {
      await this.organizations.setWorkspaceOrganization(access.workspaceId, null);
      await this.audit.record(actor, {
        action: 'organization.workspace.remove',
        targetType: 'workspace',
        targetId: access.workspaceId,
        workspaceId: access.workspaceId,
        organizationId: current.id,
      });
    }
    return { id: access.workspaceId, workspaceId: access.workspaceId };
  }

  /** Your role, from your own membership row; not being a member reads as "not found". */
  private async role(actor: Actor, organizationId: string, needs: 'member' | 'manage' | 'owner' = 'member'): Promise<OrgRole> {
    const role = await this.organizations.myRole(organizationId, actor.userId);
    if (!role) throw DomainError.notFound('Organization');
    if (needs === 'manage' && !canManageOrg(role)) throw DomainError.forbidden('Only owners and admins can do this');
    if (needs === 'owner' && role !== 'owner') throw DomainError.forbidden('Only owners can do this');
    return role;
  }

  private inOrg<T>(organizationId: string, userId: string, work: () => Promise<T>): Promise<T> {
    return this.transactional.runInScope({ kind: 'organization', organizationId, userId }, work);
  }

  private async found(organizationId: string): Promise<OrganizationRecord> {
    const organization = await this.organizations.find(organizationId);
    if (!organization) throw DomainError.notFound('Organization');
    return organization;
  }

  private record(actor: Actor, organizationId: string, action: string, metadata: Record<string, unknown>): Promise<void> {
    return this.audit.record(actor, { action, targetType: 'organization', targetId: organizationId, organizationId, metadata });
  }
}

function validName(name: string): string {
  const clean = name.trim();
  if (!clean || clean.length > ORG_NAME_MAX) throw DomainError.invalid(`Give the organization a name of up to ${ORG_NAME_MAX} characters`);
  return clean;
}

function toResponse(record: OrganizationRecord, role: OrgRole): OrganizationResponse {
  return { id: record.id, name: record.name, role, twoStepRequired: record.twoStepRequired, createdAt: record.createdAt.toISOString() };
}
