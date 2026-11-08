import { Injectable } from '@nestjs/common';
import { canInSpace, explainPermission, isAccessGrantDays, isSpaceScoped, PERMISSIONS, type AccessExplanation, type AccessGrantResponse, type AccessRequestResponse, type Permission } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { AccessService } from '../../../core/access/access.service.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { Clock } from '../../../core/time/clock.port.js';
import { AccessGrantRepository } from '../domain/access-grant.repository.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { MembersService } from '../../members/application/members.service.js';
import { NotificationsService } from '../../notifications/application/notifications.service.js';
import { RoleAccessService } from '../../roles/application/role-access.service.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';

const NOTE_MAX = 200;
/** People an access request reaches at most (everyone who can manage roles, usually a handful). */
const RECIPIENTS_MAX = 20;

export interface ExplainedAccess extends AccessExplanation {
  userId: string;
  roleName: string;
  permission: Permission;
  spaceId: string | null;
}

/**
 * E3: why someone can or can't do something (the access checker), and asking
 * for access you don't have. Explanations come from the same policy documents
 * the access checks evaluate, and are checked against the real decision.
 */
@Injectable()
export class AccessReviewService {
  constructor(
    private readonly members: MembersService,
    private readonly roleAccess: RoleAccessService,
    private readonly accessService: AccessService,
    private readonly spaces: SpacesService,
    private readonly notifications: NotificationsService,
    private readonly auditLogger: AuditLogger,
    private readonly grants: AccessGrantRepository,
    private readonly clock: Clock,
  ) {}

  /** For role managers: explains any member's access. For anyone: their own (the resolver decides). */
  async explain(workspaceId: string, userId: string, permission: string, spaceId: string | null): Promise<ExplainedAccess> {
    const key = this.permission(permission);
    const space = spaceId && isSpaceScoped(key) ? (await this.spaces.getInWorkspace(workspaceId, spaceId)).id : null;
    const roleId = await this.members.roleOf(workspaceId, userId);
    const sources = roleId ? await this.roleAccess.labelledPolicies(workspaceId, roleId) : null;
    if (!roleId || !sources) throw DomainError.notFound('Member');
    // Running grants explain themselves too (E3): a grant for one project reads as "allowed, but not elsewhere".
    const running = (await this.grants.listActiveGrants(workspaceId, this.clock.now(), 100)).filter((grant) => grant.userId === userId && grant.permission === key);
    const grantPolicies = running.map((grant) => ({
      source: `Temporary access until ${grant.expiresAt.slice(0, 10)}${grant.grantedByName ? `, approved by ${grant.grantedByName}` : ''}`,
      document: {
        statements: grant.spaceId
          ? [{ effect: 'allow' as const, permissions: [key] }, { effect: 'deny' as const, permissions: [key], notSpaces: [grant.spaceId] }]
          : [{ effect: 'allow' as const, permissions: [key] }],
      },
    }));
    const explanation = explainPermission([...sources.policies, ...grantPolicies], key, space);
    // The explanation must say what the real check decides; if they ever disagree, the real check wins.
    const real = await this.accessService.resolveMember(userId, workspaceId);
    const allowed = real ? (space ? canInSpace(real, space, key) : real.permissions.has(key)) : false;
    return { ...explanation, allowed, verdict: allowed === explanation.allowed ? explanation.verdict : allowed ? 'allowed' : 'denied', userId, roleName: sources.roleName, permission: key, spaceId: space };
  }

  /**
   * Asks the workspace's role managers for a permission. Audited; the request
   * carries what and where, and your note as plain text. Nothing changes until
   * someone edits a role.
   */
  async request(actor: Actor, access: WorkspaceAccess, input: { permission: string; spaceId?: string | null; note?: string | null }): Promise<number> {
    const key = this.permission(input.permission);
    const space = input.spaceId && isSpaceScoped(key) ? await this.spaces.getInWorkspace(access.workspaceId, input.spaceId) : null;
    if (space ? canInSpace(access, space.id, key) : access.permissions.has(key)) throw DomainError.invalid('You already have this access');
    const note = (input.note ?? '').trim();
    if (note.length > NOTE_MAX) throw DomainError.invalid(`Keep the note under ${NOTE_MAX} characters`);
    const recipients = (await this.members.listUserIdsWithPermission(access.workspaceId, 'roles.manage')).filter((id) => id !== actor.userId).slice(0, RECIPIENTS_MAX);
    if (recipients.length === 0) throw DomainError.invalid('Nobody in this workspace can change roles yet');
    await this.grants.createRequest({ workspaceId: access.workspaceId, requesterId: actor.userId, permission: key, spaceId: space?.id ?? null, note });
    const subject = space ? `${key} in ${space.name}` : key;
    await this.notifications.send(
      recipients.map((recipientId) => ({
        workspaceId: access.workspaceId,
        recipientId,
        actorId: actor.userId,
        kind: 'access_requested' as const,
        entityType: 'member',
        entityId: actor.userId,
        taskId: null,
        subject: subject.slice(0, 300),
        excerpt: note,
      })),
    );
    await this.auditLogger.record(actor, { action: 'access.request', targetType: 'permission', targetId: key, workspaceId: access.workspaceId, metadata: { permission: key, spaceId: space?.id ?? null, recipients: recipients.length } });
    return recipients.length;
  }

  /** Requests waiting for someone who manages roles (roles.manage, checked by the resolver). */
  pendingRequests(workspaceId: string): Promise<AccessRequestResponse[]> {
    return this.grants.listRequests(workspaceId, 'pending', 50);
  }

  /** Grants still running, soonest to end first. */
  activeGrants(workspaceId: string): Promise<AccessGrantResponse[]> {
    return this.grants.listActiveGrants(workspaceId, this.clock.now(), 100);
  }

  /**
   * Approves a request in one click, as a grant that ends after `days`, or declines it.
   * Only for people who manage roles, never their own request, and only for access the
   * approver has themselves (where it was asked for). A deny in the requester's role still
   * wins over the grant. Audited, and the requester is told either way.
   */
  @Announces('member.updated', { ...workspaceFromAccess, entity: (result: { userId: string; workspaceId: string }) => ({ id: result.userId, workspaceId: result.workspaceId }) })
  async decide(actor: Actor, access: WorkspaceAccess, requestId: string, approve: boolean, days: number | null): Promise<{ userId: string; workspaceId: string; request: AccessRequestResponse; grant: AccessGrantResponse | null }> {
    const request = found(await this.grants.findRequest(access.workspaceId, requestId), 'Access request');
    if (request.status !== 'pending') throw DomainError.conflict('Someone already decided this request');
    if (request.requesterId === actor.userId) throw DomainError.forbidden('Someone else has to decide your own request');
    const key = this.permission(request.permission);
    let grant: AccessGrantResponse | null = null;
    if (approve) {
      if (!isAccessGrantDays(days)) throw DomainError.invalid('Approve for 1, 7 or 30 days');
      const yours = request.spaceId ? canInSpace(access, request.spaceId, key) : access.permissions.has(key);
      if (!yours) throw DomainError.forbidden('You can only hand out access you have yourself');
      if (!(await this.members.roleOf(access.workspaceId, request.requesterId))) throw DomainError.invalid('They are no longer in this workspace');
    }
    // Decided once: a second click, or a second manager at the same moment, finds it done.
    if (!(await this.grants.decideRequest(access.workspaceId, request.id, approve ? 'approved' : 'declined', actor.userId))) throw DomainError.conflict('Someone already decided this request');
    if (approve) {
      const expiresAt = new Date(this.clock.now().getTime() + days! * 86_400_000);
      const id = await this.grants.createGrant({ workspaceId: access.workspaceId, userId: request.requesterId, permission: key, spaceId: request.spaceId, expiresAt, grantedBy: actor.userId, requestId: request.id });
      grant = await this.grants.findGrant(access.workspaceId, id);
    }
    const where = request.spaceName ? `${key} in ${request.spaceName}` : key;
    await this.notifications.send([
      {
        workspaceId: access.workspaceId,
        recipientId: request.requesterId,
        actorId: actor.userId,
        kind: 'access_decided' as const,
        entityType: 'member',
        entityId: request.requesterId,
        taskId: null,
        subject: (approve ? `${where}: approved for ${days === 1 ? '1 day' : `${days} days`}` : `${where}: declined`).slice(0, 300),
        excerpt: '',
      },
    ]);
    await this.auditLogger.record(actor, {
      action: approve ? 'access.grant' : 'access.request.decline',
      targetType: 'member',
      targetId: request.requesterId,
      workspaceId: access.workspaceId,
      metadata: { permission: key, spaceId: request.spaceId, days: approve ? days : null, requestId: request.id },
    });
    return { userId: request.requesterId, workspaceId: access.workspaceId, request: { ...request, status: approve ? 'approved' : 'declined' }, grant };
  }

  /** Ends a grant early (roles.manage). Audited. */
  @Announces('member.updated', { ...workspaceFromAccess, entity: (result: AccessGrantResponse & { workspaceId: string }) => ({ id: result.userId, workspaceId: result.workspaceId }) })
  async revoke(actor: Actor, access: WorkspaceAccess, grantId: string): Promise<AccessGrantResponse & { workspaceId: string }> {
    const grant = found(await this.grants.findGrant(access.workspaceId, grantId), 'Grant');
    await this.grants.deleteGrant(access.workspaceId, grant.id);
    await this.auditLogger.record(actor, { action: 'access.grant.revoke', targetType: 'member', targetId: grant.userId, workspaceId: access.workspaceId, metadata: { permission: grant.permission, spaceId: grant.spaceId } });
    return { ...grant, workspaceId: access.workspaceId };
  }

  private permission(value: string): Permission {
    if (!(PERMISSIONS as readonly string[]).includes(value)) throw DomainError.invalid('Unknown permission');
    return value as Permission;
  }
}
