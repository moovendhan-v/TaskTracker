import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import type { GraphQLFormattedError } from 'graphql';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { complexityPlugin } from './complexity.plugin.js';
import { depthLimitRule } from './depth-limit.rule.js';
import './enums.js';

export const GRAPHQL_PATH = '/graphql';
export const MAX_QUERY_DEPTH = 8;
export const MAX_QUERY_COMPLEXITY = 5_000;
/** Bounds parsing work before validation runs. The largest SDK operation is a few hundred tokens. */
export const MAX_QUERY_TOKENS = 2_000;

/** Removes "Did you mean …?" hints, which would reveal schema names when introspection is off. */
function withoutSchemaHints(error: GraphQLFormattedError): GraphQLFormattedError {
  return { ...error, message: error.message.replace(/ Did you mean .*\?$/, '') };
}

/**
 * Code-first GraphQL at /api/graphql: the whole TaskFlow API. Each module's
 * presentation layer holds its resolvers, which only map arguments to service
 * calls; permissions are checked by guards and business rules live in services.
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ENV],
      useFactory: (env: Env): ApolloDriverConfig => {
        const production = env.NODE_ENV === 'production';
        return {
          path: GRAPHQL_PATH,
          useGlobalPrefix: true,
          autoSchemaFile: true,
          sortSchema: true,
          playground: false,
          introspection: !production,
          // Requests must be JSON or carry a preflight header, so plain HTML forms can't send them.
          csrfPrevention: true,
          includeStacktraceInErrorResponses: false,
          context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
          parseOptions: { maxTokens: MAX_QUERY_TOKENS },
          validationRules: [depthLimitRule(MAX_QUERY_DEPTH)],
          plugins: [ApolloServerPluginLandingPageDisabled(), complexityPlugin(MAX_QUERY_COMPLEXITY)],
          formatError: (error) => (production ? withoutSchemaHints(error) : error),
        };
      },
    }),
  ],
})
export class GraphqlApiModule {}
