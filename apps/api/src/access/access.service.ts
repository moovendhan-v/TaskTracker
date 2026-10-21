import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PERMISSIONS, type Permission } from '@taskflow/shared-types';
import type { SessionUser, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity.js';

/** Single place that decides what a user may do inside a workspace. */
@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(WorkspaceMemberEntity) private readonly members: Repository<WorkspaceMemberEntity>,
    @InjectRepository(WorkspaceEntity) private readonly workspaces: Repository<WorkspaceEntity>,
  ) {}

  /** Returns null when the user has no access, so callers answer 404 and don't reveal the workspace exists. */
  async resolve(user: SessionUser, workspaceId: string): Promise<WorkspaceAccess | null> {
    const membership = await this.members.findOne({
      where: { workspaceId, userId: user.id },
      relations: { role: true },
    });

    if (membership?.role) {
      return {
        workspaceId,
        roleId: membership.roleId,
        permissions: new Set(membership.role.permissions),
        viaPlatformRole: false,
      };
    }

    if (user.platformRole === 'SUPER_ADMIN' && (await this.workspaces.exists({ where: { id: workspaceId } }))) {
      return { workspaceId, roleId: null, permissions: new Set(PERMISSIONS), viaPlatformRole: true };
    }
    return null;
  }

  static hasAll(access: WorkspaceAccess, required: readonly Permission[]): boolean {
    return required.every((permission) => access.permissions.has(permission));
  }
}
