import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { Args, GqlExecutionContext } from '@nestjs/graphql';
import type { ResourceQuery } from '@taskflow/shared-types';
import { ResourceQueryInput } from '../graphql/resource-query.types.js';
import type { AuthenticatedRequest } from '../http/types/authenticated-request.js';
import { normalizeQuery, type NormalizedQuery } from './normalize-query.js';
import { queryResource } from './query-resource.decorators.js';

/** Declares the optional `query: ResourceQueryInput` argument in the schema. Pair it with @ValidatedQuery. */
export const ResourceQueryArg = (): ParameterDecorator => Args('query', { type: () => ResourceQueryInput, nullable: true });

/**
 * The `query` argument checked against a query resource for the current caller
 * (fields they may see, `@me`, limits), ready for the repository. Bad filters
 * fail with BAD_USER_INPUT before the resolver runs.
 *
 *   tasks(@ResourceQueryArg() _query: unknown, @ValidatedQuery('tasks') query: NormalizedQuery)
 */
export const ValidatedQuery = createParamDecorator((resource: string, context: ExecutionContext): NormalizedQuery => {
  const gql = GqlExecutionContext.create(context);
  const { query } = gql.getArgs<{ query?: ResourceQuery | null }>();
  const request = gql.getContext<{ req: AuthenticatedRequest }>().req;
  return normalizeQuery(queryResource(resource), query, {
    userId: request.user?.id ?? null,
    permissions: request.workspaceAccess?.permissions ?? new Set(),
  });
});
