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
import type { AuthenticatedRequest } from '../http/types/authenticated-request.js';
import { AuditLogger } from '../audit/audit-logger.port.js';
import { AccessService } from './access.service.js';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AccessService,
    private readonly auditLogger: AuditLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const workspaceId = request.params['workspaceId'];
    if (typeof workspaceId !== 'string' || !isUUID(workspaceId)) throw new NotFoundException();

    const access = await this.accessService.resolve(request.user, workspaceId);
    if (!access) throw new NotFoundException();

    const required =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!AccessService.hasAll(access, required)) throw new ForbiddenException('Missing workspace permission');

    if (access.viaPlatformRole && !READ_METHODS.has(request.method)) {
      await this.auditLogger.record(
        { userId: request.user.id, platformRole: request.user.platformRole, ip: request.ip ?? null },
        {
          action: 'platform_admin.workspace_write',
          targetType: 'workspace',
          targetId: workspaceId,
          workspaceId,
          metadata: { method: request.method, path: request.route?.path ?? null },
        },
      );
    }

    request.workspaceAccess = access;
    return true;
  }
}
