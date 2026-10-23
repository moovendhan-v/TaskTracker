import type { ApolloServerPlugin } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';

/**
 * Rejects operations whose estimated cost is above `maxComplexity` before any
 * resolver runs. Fields can raise their own cost with `@Field({ complexity })`.
 */
export function complexityPlugin(maxComplexity: number): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ request, document, schema }) {
          const complexity = getComplexity({
            schema,
            query: document,
            operationName: request.operationName,
            variables: request.variables,
            estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })],
          });
          if (complexity > maxComplexity) {
            throw new GraphQLError(`Query is too complex (${complexity}); the limit is ${maxComplexity}`, {
              extensions: { code: 'QUERY_TOO_COMPLEX', http: { status: 400 } },
            });
          }
        },
      };
    },
  };
}
