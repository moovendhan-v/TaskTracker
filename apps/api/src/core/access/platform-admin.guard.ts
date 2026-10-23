import { type CanActivate, type ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { getRequest } from '../http/request-context.js';

/**
 * Platform admin routes answer 404 to everyone else, so their existence isn't revealed.
 * Runs after the global SessionGuard, which has already set req.user.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (getRequest(context).user?.platformRole !== 'SUPER_ADMIN') throw new NotFoundException();
    return true;
  }
}
