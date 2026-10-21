import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { API_PREFIX } from './bootstrap/api-prefix.js';
import { mountAuthRoutes } from './bootstrap/auth-routes.bootstrap.js';
import { applyBodyParsers } from './bootstrap/body-parsers.bootstrap.js';
import { applySecurity } from './bootstrap/security.bootstrap.js';
import { setupSwagger } from './bootstrap/swagger.bootstrap.js';
import { applyValidation } from './bootstrap/validation.bootstrap.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: ['log', 'warn', 'error'],
  });
  const env = app.get<Env>(ENV);

  applySecurity(app, env);
  mountAuthRoutes(app);
  applyBodyParsers(app);
  app.setGlobalPrefix(API_PREFIX);
  applyValidation(app, env);
  setupSwagger(app, env);
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(`TaskFlow API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
