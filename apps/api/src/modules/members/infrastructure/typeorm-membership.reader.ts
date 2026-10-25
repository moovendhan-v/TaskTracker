import { Injectable } from '@nestjs/common';
import { MembershipReader, type MembershipGrant } from '../../../core/access/membership-reader.port.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
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
  ) {
    super();
  }

  /**
   * User scope: a user can read their own memberships and the roles they hold.
   * Every request asks this, so it is cached; member, role and policy changes drop
   * the entry at once, and the short TTL bounds staleness if the cache misses an event.
   */
  @Cached({ entities: ['access'], shared: true, ttlSeconds: 60 })
  async findGrant(workspaceId: string, userId: string): Promise<MembershipGrant | null> {
    return this.transactional.runInScope({ kind: 'user', userId }, async () => {
      const membership = await this.members.findMembership(workspaceId, userId);
      return membership ? { roleId: membership.roleId, permissions: membership.permissions } : null;
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
