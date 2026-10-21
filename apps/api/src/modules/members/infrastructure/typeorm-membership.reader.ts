import { Injectable } from '@nestjs/common';
import { MembershipReader, type MembershipGrant } from '../../../core/access/membership-reader.port.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { WorkspaceMemberRepository } from '../domain/workspace-member.repository.js';

/** Adapter for core's MembershipReader port, wired in app.module via AccessModule.forRoot. */
@Injectable()
export class TypeOrmMembershipReader extends MembershipReader {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly transactional: TransactionalManager,
  ) {
    super();
  }

  async findGrant(workspaceId: string, userId: string): Promise<MembershipGrant | null> {
    const membership = await this.members.findMembership(workspaceId, userId);
    return membership ? { roleId: membership.roleId, permissions: membership.permissions } : null;
  }

  workspaceExists(workspaceId: string): Promise<boolean> {
    return this.transactional.manager
      .createQueryBuilder()
      .from('workspace', 'workspace')
      .where('workspace.id = :workspaceId', { workspaceId })
      .getExists();
  }
}
