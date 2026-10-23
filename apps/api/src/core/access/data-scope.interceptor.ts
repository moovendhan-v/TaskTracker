import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { GqlContextType } from '@nestjs/graphql';
import { from, lastValueFrom, type Observable } from 'rxjs';
import type { DataScope } from '../database/data-scope.js';
import { TransactionalManager } from '../database/transactional-manager.js';
import { getRequest, isSubscription } from '../http/request-context.js';
import type { AuthenticatedRequest } from '../http/types/authenticated-request.js';
import { REQUIRES_PLATFORM_ADMIN_KEY } from './require-platform-admin.decorator.js';

/**
 * The row-level security scope for an operation, from what the guards already
 * decided. Null means no tenant data is reachable (public operations).
 */
export function resolveDataScope(request: Pick<AuthenticatedRequest, 'user' | 'workspaceAccess'>, requiresPlatformAdmin: boolean): DataScope | null {
  const user = request.user as AuthenticatedRequest['user'] | undefined;
  if (request.workspaceAccess) {
    return { kind: 'workspace', workspaceId: request.workspaceAccess.workspaceId, userId: user?.id ?? null };
  }
  if (!user) return null;
  if (requiresPlatformAdmin && user.platformRole === 'SUPER_ADMIN') return { kind: 'platform' };
  return { kind: 'user', userId: user.id };
}

/**
 * Runs each GraphQL operation in one transaction scoped for row-level security.
 * Interceptors run after guards, so membership and permissions are already checked.
 */
@Injectable()
export class DataScopeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly transactional: TransactionalManager,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // A subscription lives as long as its socket, so it can't hold a transaction; it reads no tenant rows itself.
    if (context.getType<GqlContextType>() !== 'graphql' || isSubscription(context)) return next.handle();

    const requiresPlatformAdmin =
      this.reflector.getAllAndOverride<boolean>(REQUIRES_PLATFORM_ADMIN_KEY, [context.getHandler(), context.getClass()]) ?? false;
    const scope = resolveDataScope(getRequest(context), requiresPlatformAdmin);
    if (!scope) return next.handle();

    return from(this.transactional.runInScope(scope, () => lastValueFrom(next.handle(), { defaultValue: undefined })));
  }
}
