import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { WorkspaceAccess } from '../http/types/authenticated-request.js';
import { getRequest } from '../http/request-context.js';

/** The access record resolved by WorkspaceAccessGuard for this request. */
export const CurrentAccess = createParamDecorator((_data: unknown, ctx: ExecutionContext): WorkspaceAccess => {
  const access = getRequest(ctx).workspaceAccess;
  if (!access) throw new Error('CurrentAccess used on a route without @RequirePermissions');
  return access;
});
