import type { NestExpressApplication } from '@nestjs/platform-express';

const BODY_LIMIT = '1mb';

export function applyBodyParsers(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });
}
