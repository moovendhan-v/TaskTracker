import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../http/decorators/public.decorator.js';
import { getRequest } from '../http/request-context.js';
import { AuthService } from './auth.service.js';

/** Global guard: every GraphQL operation (and the health probe) needs a valid session unless marked @Public(). Fails closed. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = getRequest(context);
    const user = await this.authService.getSessionUser(request.headers).catch(() => null);
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}
