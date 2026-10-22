import type { NestExpressApplication } from '@nestjs/platform-express';

/** Enough for the largest document body (see DOC_CONTENT_MAX) plus the GraphQL query. */
const BODY_LIMIT = '1mb';

/** GraphQL only accepts JSON, so no other body parser is registered. Better Auth parses its own bodies. */
export function applyBodyParsers(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: BODY_LIMIT });
}
