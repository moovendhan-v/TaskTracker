import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from '../core/auth/auth.service.js';
import { API_PREFIX } from './api-prefix.js';

/** Better Auth reads the raw body itself, so mount it before Nest's body parsers. */
export function mountAuthRoutes(app: NestExpressApplication): void {
  const { auth } = app.get(AuthService);
  app.getHttpAdapter().getInstance().all(`/${API_PREFIX}/auth/{*path}`, toNodeHandler(auth));
}
