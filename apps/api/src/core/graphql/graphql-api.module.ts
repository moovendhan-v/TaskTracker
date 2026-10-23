import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import type { GraphQLFormattedError } from 'graphql';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthService } from '../auth/auth.service.js';
import { isAllowedOrigin, type SocketExtra } from '../realtime/websocket-auth.js';
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
      imports: [AuthModule],
      inject: [ENV, AuthService],
      useFactory: (env: Env, authService: AuthService): ApolloDriverConfig => {
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
          // HTTP operations get the Express request; subscriptions get a request-like object built
          // from the WebSocket handshake, so the same guards and decorators work for both.
          context: ({ req, res, extra }: { req?: unknown; res?: unknown; extra?: SocketExtra }) =>
            extra
              ? { req: { headers: extra.request.headers, ip: extra.request.socket.remoteAddress ?? null, user: extra.user } }
              : { req, res },
          subscriptions: {
            'graphql-ws': {
              // The driver adds the global prefix, so this serves /api/graphql like HTTP.
              path: GRAPHQL_PATH,
              // Clients must send connection_init within 3 seconds or the socket is closed.
              connectionInitWaitTimeout: 3_000,
              // Refuse the socket unless it comes from an allowed origin with a valid session.
              onConnect: async (context: { extra: unknown }) => {
                const extra = context.extra as SocketExtra;
                const { request } = extra;
                if (!isAllowedOrigin(request.headers, env.CORS_ORIGINS)) return false;
                const user = await authService.getSessionUser(request.headers).catch(() => null);
                if (!user) return false;
                extra.user = user;
                return true;
              },
            },
          },
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
