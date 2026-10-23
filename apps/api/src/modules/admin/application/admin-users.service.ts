import { Injectable } from '@nestjs/common';
import type { AdminUserQuery, AdminUserResponse, Paginated, UpdateAdminUserRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { toPageRequest } from '../../../core/domain/page-request.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { AdminUserRepository } from '../domain/admin-user.repository.js';
import { PlatformRolePolicy } from '../domain/platform-role.policy.js';
import { AdminMapper } from './admin.mapper.js';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly users: AdminUserRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
  ) {}

  async list(query: AdminUserQuery): Promise<Paginated<AdminUserResponse>> {
    const page = toPageRequest(query);
    const result = await this.users.page(query.search?.trim() || undefined, page);
    return { items: result.items.map(AdminMapper.user), total: result.total, ...page };
  }

  async update(actor: Actor, userId: string, request: UpdateAdminUserRequest): Promise<AdminUserResponse> {
    await this.unitOfWork.run(async () => {
      const target = await this.users.findById(userId);
      if (!target) throw DomainError.notFound('User');
      PlatformRolePolicy.assertAllowed({
        actorId: actor.userId,
        target,
        next: request,
        activeSuperAdmins: await this.users.countActiveSuperAdminsForUpdate(),
      });

      await this.users.update(userId, request);
      if (request.suspended === true) await this.users.revokeSessions(userId);
      await this.auditLogger.record(actor, {
        action: describeChange(request),
        targetType: 'user',
        targetId: userId,
        metadata: { email: target.email, before: { platformRole: target.platformRole, suspended: target.suspended }, after: request },
      });
    });

    const updated = await this.users.findById(userId);
    if (!updated) throw DomainError.notFound('User');
    return AdminMapper.user(updated);
  }
}

function describeChange(request: UpdateAdminUserRequest): string {
  if (request.suspended === true) return 'admin.user.suspend';
  if (request.suspended === false) return 'admin.user.reactivate';
  if (request.platformRole === 'SUPER_ADMIN') return 'admin.user.promote';
  if (request.platformRole === 'USER') return 'admin.user.demote';
  return 'admin.user.update';
}
