import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor } from '../types/authenticated-request.js';
import { getRequest } from '../request-context.js';

export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = getRequest(ctx);
  return { userId: request.user.id, platformRole: request.user.platformRole, ip: request.ip ?? null };
});
