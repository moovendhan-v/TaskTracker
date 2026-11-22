import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { getRequest } from '../http/request-context.js';
import { AccessService } from './access.service.js';

/**
 * Platform admin routes answer 404 to everyone else, so their existence isn't revealed.
 * Runs after the global SessionGuard, which has already set req.user. Admins also need two-step
 * sign-in (an authenticator app or a passkey) when PLATFORM_ADMIN_REQUIRE_TWO_STEP is on, as it
 * is in production: a stolen password alone doesn't open the admin console. Fails closed.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly access: AccessService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = getRequest(context).user;
    if (user?.platformRole !== 'SUPER_ADMIN') throw new NotFoundException();
    if (this.env.PLATFORM_ADMIN_REQUIRE_TWO_STEP && !(await this.access.hasTwoStep(user.id))) {
      throw new ForbiddenException('Set up two-step sign-in (Security) to use the admin console');
    }
    return true;
  }
}
