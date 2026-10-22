import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import type { OperationTypeNode } from 'graphql';
import type { AuthenticatedRequest } from './types/authenticated-request.js';

/** The Express request for both REST and GraphQL calls, so guards and decorators serve both. */
export function getRequest(context: ExecutionContext): AuthenticatedRequest {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: AuthenticatedRequest }>().req;
  }
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

/**
 * The workspace a call targets: the `:workspaceId` route param for REST,
 * or the top-level `workspaceId` argument for GraphQL.
 */
export function getWorkspaceIdTarget(context: ExecutionContext): unknown {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getArgs<{ workspaceId?: unknown }>().workspaceId;
  }
  return context.switchToHttp().getRequest<AuthenticatedRequest>().params['workspaceId'];
}

/** True for REST methods that change data and for GraphQL mutations. */
export function isWriteOperation(context: ExecutionContext): boolean {
  if (context.getType<GqlContextType>() === 'graphql') {
    const operation = GqlExecutionContext.create(context).getInfo<{ operation: { operation: OperationTypeNode } }>().operation;
    return operation.operation !== 'query';
  }
  return !['GET', 'HEAD', 'OPTIONS'].includes(context.switchToHttp().getRequest<AuthenticatedRequest>().method);
}

/** A short label for audit entries: the REST route or the GraphQL field name. */
export function describeOperation(context: ExecutionContext): string {
  if (context.getType<GqlContextType>() === 'graphql') {
    return `graphql:${GqlExecutionContext.create(context).getInfo<{ fieldName: string }>().fieldName}`;
  }
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return `${request.method} ${request.route?.path ?? ''}`;
}
