import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import type { SystemRoleKey } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { pageRawWithResourceQuery } from '../../../core/query/apply-resource-query.js';
import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { MemberDetails, MembershipWithRole, NewWorkspaceMember } from '../domain/workspace-member.js';
import { WorkspaceMemberRepository } from '../domain/workspace-member.repository.js';
import { WorkspaceMemberOrmEntity } from './workspace-member.orm-entity.js';

interface MembershipRow {
  workspace_id: string;
  user_id: string;
  role_id: string;
  role_name: string;
  role_system_key: SystemRoleKey | null;
}

interface DetailsRow {
  user_id: string;
  name: string;
  email: string;
  role_id: string;
  role_name: string;
  joined_at: Date;
}

/** Joins roles and users by table name so this module doesn't import other modules' ORM entities. */
@Injectable()
export class TypeOrmWorkspaceMemberRepository extends WorkspaceMemberRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(WorkspaceMemberOrmEntity);
  }

  async findMembership(workspaceId: string, userId: string): Promise<MembershipWithRole | null> {
    const row = await this.membershipQuery()
      .where('member.workspace_id = :workspaceId AND member.user_id = :userId', { workspaceId, userId })
      .getRawOne<MembershipRow>();
    return row ? toMembership(row) : null;
  }

  async listMembershipsForUser(userId: string): Promise<MembershipWithRole[]> {
    const rows = await this.membershipQuery()
      .where('member.user_id = :userId', { userId })
      .orderBy('member.created_at', 'ASC')
      .getRawMany<MembershipRow>();
    return rows.map(toMembership);
  }

  async listDetails(workspaceId: string): Promise<MemberDetails[]> {
    const rows = await this.detailsQuery()
      .where('member.workspace_id = :workspaceId', { workspaceId })
      .orderBy('member.created_at', 'ASC')
      .getRawMany<DetailsRow>();
    return rows.map(toDetails);
  }

  async searchDetails(workspaceId: string, query: NormalizedQuery): Promise<{ items: MemberDetails[]; total: number }> {
    const builder = this.detailsQuery().where('member.workspace_id = :workspaceId', { workspaceId });
    const { rows, total } = await pageRawWithResourceQuery<DetailsRow>(builder, query);
    return { items: rows.map(toDetails), total };
  }

  async findDetails(workspaceId: string, userId: string): Promise<MemberDetails | null> {
    const row = await this.detailsQuery()
      .where('member.workspace_id = :workspaceId AND member.user_id = :userId', { workspaceId, userId })
      .getRawOne<DetailsRow>();
    return row ? toDetails(row) : null;
  }

  isMember(workspaceId: string, userId: string): Promise<boolean> {
    return this.repository.exists({ where: { workspaceId, userId } });
  }

  async listMembersWithRoles(workspaceId: string): Promise<{ userId: string; roleId: string }[]> {
    const rows = await this.repository.find({ where: { workspaceId }, select: { userId: true, roleId: true } });
    return rows.map(({ userId, roleId }) => ({ userId, roleId }));
  }


  async addIfAbsent(member: NewWorkspaceMember): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values(member)
      .orIgnore()
      .returning('id')
      .execute();
    return result.raw.length > 0;
  }

  async updateRole(workspaceId: string, userId: string, roleId: string): Promise<void> {
    await this.repository.update({ workspaceId, userId }, { roleId });
  }

  async remove(workspaceId: string, userId: string): Promise<void> {
    await this.repository.delete({ workspaceId, userId });
  }

  async countWithRoleForUpdate(workspaceId: string, roleId: string): Promise<number> {
    const rows = await this.repository
      .createQueryBuilder('member')
      .setLock('pessimistic_write')
      .where('member.workspace_id = :workspaceId AND member.role_id = :roleId', { workspaceId, roleId })
      .getMany();
    return rows.length;
  }

  private membershipQuery(): SelectQueryBuilder<WorkspaceMemberOrmEntity> {
    return this.repository
      .createQueryBuilder('member')
      .innerJoin('workspace_role', 'role', 'role.id = member.role_id')
      .select([
        'member.workspace_id AS workspace_id',
        'member.user_id AS user_id',
        'member.role_id AS role_id',
        'role.name AS role_name',
        'role.system_key AS role_system_key',
      ]);
  }

  private detailsQuery(): SelectQueryBuilder<WorkspaceMemberOrmEntity> {
    return this.repository
      .createQueryBuilder('member')
      .innerJoin('workspace_role', 'role', 'role.id = member.role_id')
      .innerJoin('user', 'account', 'account.id = member.user_id')
      .select([
        'member.user_id AS user_id',
        'account.name AS name',
        'account.email AS email',
        'member.role_id AS role_id',
        'role.name AS role_name',
        'member.created_at AS joined_at',
      ]);
  }
}

function toMembership(row: MembershipRow): MembershipWithRole {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    roleId: row.role_id,
    roleName: row.role_name,
    roleSystemKey: row.role_system_key,
  };
}

function toDetails(row: DetailsRow): MemberDetails {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    roleId: row.role_id,
    roleName: row.role_name,
    joinedAt: new Date(row.joined_at),
  };
}
