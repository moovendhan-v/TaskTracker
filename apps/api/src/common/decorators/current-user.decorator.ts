import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, SessionUser } from '../http/authenticated-request.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
