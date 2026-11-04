import { Injectable } from '@nestjs/common';
import { canInSpace, explainPermission, isSpaceScoped, PERMISSIONS, type AccessExplanation, type Permission } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { AccessService } from '../../../core/access/access.service.js';
import { DomainError } from '../../../core/domain/domain-error.js';
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
  ) {}

  /** For role managers: explains any member's access. For anyone: their own (the resolver decides). */
  async explain(workspaceId: string, userId: string, permission: string, spaceId: string | null): Promise<ExplainedAccess> {
    const key = this.permission(permission);
    const space = spaceId && isSpaceScoped(key) ? (await this.spaces.getInWorkspace(workspaceId, spaceId)).id : null;
    const roleId = await this.members.roleOf(workspaceId, userId);
    const sources = roleId ? await this.roleAccess.labelledPolicies(workspaceId, roleId) : null;
    if (!roleId || !sources) throw DomainError.notFound('Member');
    const explanation = explainPermission(sources.policies, key, space);
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

  private permission(value: string): Permission {
    if (!(PERMISSIONS as readonly string[]).includes(value)) throw DomainError.invalid('Unknown permission');
    return value as Permission;
  }
}
