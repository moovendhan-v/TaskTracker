import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import type { Env } from '../config/env.schema.js';
import { API_PREFIX } from './api-prefix.js';

const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=()';

/** Security headers (AGENTS.md rule 18) and the CORS allowlist (rule 7). */
export function applySecurity(app: NestExpressApplication, env: Env): void {
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
  // The public intake (E6.3) is called from customers' own sites by the feedback widget: any
  // origin, never with credentials (it carries no cookies; its own origin allowlist, CAPTCHA and
  // rate limits apply in the controller). Everything else: only TaskFlow's own origins.
  app.enableCors((request: Request, callback: (error: Error | null, options: CorsOptions) => void) => {
    const publicIntake = (request.url ?? '').startsWith(`/${API_PREFIX}/public/`);
    callback(
      null,
      publicIntake
        ? { origin: '*', credentials: false, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'], maxAge: 600 }
        : { origin: env.CORS_ORIGINS, credentials: true },
    );
  });
}
