import { Injectable } from '@nestjs/common';
import { PERMISSIONS, type Permission } from '@taskflow/shared-types';
import { MembershipReader, type MembershipGrant } from '../../../core/access/membership-reader.port.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { RoleAccessService } from '../../roles/application/role-access.service.js';
import { WorkspaceMemberRepository } from '../domain/workspace-member.repository.js';

/**
 * Adapter for core's MembershipReader port, wired in app.module via AccessModule.forRoot.
 * Guards call it before the operation's own transaction exists, so each lookup
 * opens a short transaction with the narrowest row-level security scope that works.
 */
@Injectable()
export class TypeOrmMembershipReader extends MembershipReader {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly transactional: TransactionalManager,
    private readonly roleAccess: RoleAccessService,
  ) {
    super();
  }

  /**
   * User scope: a user can read their own memberships and the roles they hold.
   * Every request asks this, so it is cached; member, role, policy and grant changes
   * drop the entry at once, and the short TTL bounds staleness if the cache misses an
   * event (and how long a grant outlives its end by, at most a minute).
   */
  @Cached({ entities: ['access'], shared: true, ttlSeconds: 60 })
  async findGrant(workspaceId: string, userId: string): Promise<MembershipGrant | null> {
    return this.transactional.runInScope({ kind: 'user', userId }, async () => {
      const membership = await this.members.findMembership(workspaceId, userId);
      if (!membership) return null;
      // Their running time-limited grants (E3); row-level security lets a user read their own.
      const grants = (await this.transactional.manager.query(
        `SELECT permission, space_id FROM access_grant WHERE workspace_id = $1 AND user_id = $2 AND expires_at > now() LIMIT 100`,
        [workspaceId, userId],
      )) as { permission: string; space_id: string | null }[];
      const running = grants.filter((grant) => (PERMISSIONS as readonly string[]).includes(grant.permission)).map((grant) => ({ permission: grant.permission as Permission, spaceId: grant.space_id }));
      // Row-level security lets a user read the role and policies they hold, nothing else.
      const access = await this.roleAccess.forRoleWithGrants(workspaceId, membership.roleId, running);
      return access ? { roleId: membership.roleId, permissions: access.permissions, readableFields: access.readableFields, spaceRules: access.spaceRules } : null;
    });
  }

  /** Platform scope: AccessService only asks this for super admins, who may enter any workspace. */
  @Cached({ entities: ['workspace'], shared: true, ttlSeconds: 60 })
  async workspaceExists(workspaceId: string): Promise<boolean> {
    return this.transactional.runInScope({ kind: 'platform' }, () =>
      this.transactional.manager
        .createQueryBuilder()
        .from('workspace', 'workspace')
        .where('workspace.id = :workspaceId', { workspaceId })
        .getExists(),
    );
  }
}
