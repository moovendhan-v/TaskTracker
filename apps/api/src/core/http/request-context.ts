import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import type { AuthenticatedRequest } from './types/authenticated-request.js';

function isGraphql(context: ExecutionContext): boolean {
  return context.getType<GqlContextType>() === 'graphql';
}

/**
 * The Express request behind a call. GraphQL operations are the API; plain HTTP
 * only reaches the health probe, which global guards also see.
 */
export function getRequest(context: ExecutionContext): AuthenticatedRequest {
  if (isGraphql(context)) return GqlExecutionContext.create(context).getContext<{ req: AuthenticatedRequest }>().req;
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

/** The top-level `workspaceId` argument of a GraphQL operation, unchecked. */
export function getWorkspaceIdTarget(context: ExecutionContext): unknown {
  return isGraphql(context) ? GqlExecutionContext.create(context).getArgs<{ workspaceId?: unknown }>().workspaceId : undefined;
}

function operationType(context: ExecutionContext): string | null {
  return isGraphql(context) ? GqlExecutionContext.create(context).getInfo<GraphQLResolveInfo>().operation.operation : null;
}

/** True for GraphQL mutations (and, defensively, anything that isn't GraphQL). Queries and subscriptions only read. */
export function isWriteOperation(context: ExecutionContext): boolean {
  const type = operationType(context);
  return type === null || type === 'mutation';
}

/** True for a GraphQL subscription, which runs over a WebSocket rather than one HTTP request. */
export function isSubscription(context: ExecutionContext): boolean {
  return operationType(context) === 'subscription';
}

/** A short label for audit entries: the GraphQL field name. */
export function describeOperation(context: ExecutionContext): string {
  return isGraphql(context) ? `graphql:${GqlExecutionContext.create(context).getInfo<GraphQLResolveInfo>().fieldName}` : 'http';
}
