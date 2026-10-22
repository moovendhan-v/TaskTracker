import { type CanActivate, type ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../http/types/authenticated-request.js';

/**
 * Platform admin routes answer 404 to everyone else, so their existence isn't revealed.
 * Runs after the global SessionGuard, which has already set req.user.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.platformRole !== 'SUPER_ADMIN') throw new NotFoundException();
    return true;
  }
}
