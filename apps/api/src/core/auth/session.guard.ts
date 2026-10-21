import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../http/types/authenticated-request.js';
import { IS_PUBLIC_KEY } from '../http/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';

/** Global guard: every route needs a valid session unless it is marked @Public(). Fails closed. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authService.getSessionUser(request.headers).catch(() => null);
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}
