import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Permission } from '@taskflow/shared-types';
import { AuditLogger } from '../audit/audit-logger.port.js';
import { UnitOfWork } from '../database/unit-of-work.port.js';
import { describeOperation, getRequest, getWorkspaceIdTarget, isWriteOperation } from '../http/request-context.js';
import { AccessService } from './access.service.js';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator.js';

/** Checks membership and permissions for operations that take a `workspaceId` argument. */
@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AccessService,
    private readonly auditLogger: AuditLogger,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);
    const workspaceId = getWorkspaceIdTarget(context);
    if (typeof workspaceId !== 'string' || !isUUID(workspaceId)) throw new NotFoundException();

    const access = await this.accessService.resolve(request.user, workspaceId);
    if (!access) throw new NotFoundException();

    const required =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!AccessService.hasAll(access, required)) throw new ForbiddenException('Missing workspace permission');

    // Written in its own transaction before the operation runs, so the attempt is kept even if the operation fails.
    if (access.viaPlatformRole && isWriteOperation(context)) {
      const actor = { userId: request.user.id, platformRole: request.user.platformRole, ip: request.ip ?? null };
      await this.unitOfWork.runInScope({ kind: 'workspace', workspaceId, userId: actor.userId }, () =>
        this.auditLogger.record(actor, {
          action: 'platform_admin.workspace_write',
          targetType: 'workspace',
          targetId: workspaceId,
          workspaceId,
          metadata: { operation: describeOperation(context) },
        }),
      );
    }

    request.workspaceAccess = access;
    return true;
  }
}
