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

/** Removes "Did you mean …?" hints, which would reveal schema names when introspection is off. */
function withoutSchemaHints(error: GraphQLFormattedError): GraphQLFormattedError {
  return { ...error, message: error.message.replace(/ Did you mean .*\?$/, '') };
}

/**
 * Code-first GraphQL at /api/graphql. Resolvers sit next to REST controllers in
 * each module's presentation layer and call the same services, so every
 * permission and business rule applies to both.
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ENV],
      // `env` is null when the app is built in preview mode (the OpenAPI export), so fall back to
      // the production settings rather than the more open development ones.
      useFactory: (env: Env | null): ApolloDriverConfig => {
        const production = env?.NODE_ENV !== 'development' && env?.NODE_ENV !== 'test';
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
          validationRules: [depthLimitRule(MAX_QUERY_DEPTH)],
          plugins: [ApolloServerPluginLandingPageDisabled(), complexityPlugin(MAX_QUERY_COMPLEXITY)],
          formatError: (error) => (production ? withoutSchemaHints(error) : error),
        };
      },
    }),
  ],
})
export class GraphqlApiModule {}
