import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AuthService } from './auth/auth.service.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { buildOpenApiDocument } from './openapi/swagger.js';

const BODY_LIMIT = '1mb';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: ['log', 'warn', 'error'],
  });
  const env = app.get<Env>(ENV);

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });

  // Better Auth reads the raw body itself, so it is mounted before Nest's JSON parser.
  const { auth } = app.get(AuthService);
  app.getHttpAdapter().getInstance().all('/api/auth/{*path}', toNodeHandler(auth));
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: env.NODE_ENV === 'production',
    }),
  );
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  }

  await app.listen(env.PORT);
  Logger.log(`TaskFlow API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
