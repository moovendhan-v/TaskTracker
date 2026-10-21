import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, WorkspaceAccess } from '../http/types/authenticated-request.js';

/** The access record resolved by WorkspaceAccessGuard for this request. */
export const CurrentAccess = createParamDecorator((_data: unknown, ctx: ExecutionContext): WorkspaceAccess => {
  const access = ctx.switchToHttp().getRequest<AuthenticatedRequest>().workspaceAccess;
  if (!access) throw new Error('CurrentAccess used on a route without @RequirePermissions');
  return access;
});
