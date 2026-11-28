import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AGENT_REQUEST } from '../agent/agent-tool.decorator.js';
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
    // An AI agent's operation (MCP / UTCP): the agent API authenticated its API token and built this
    // request itself; the marker is a Symbol, which nothing arriving over HTTP can carry.
    if ((request as unknown as Record<symbol, unknown>)[AGENT_REQUEST] === true && request.user) return true;
    const user = await this.authService.getSessionUser(request.headers).catch(() => null);
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}
