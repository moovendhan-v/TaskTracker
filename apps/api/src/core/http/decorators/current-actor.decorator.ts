import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor, AuthenticatedRequest } from '../types/authenticated-request.js';

export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return { userId: request.user.id, platformRole: request.user.platformRole, ip: request.ip ?? null };
});
