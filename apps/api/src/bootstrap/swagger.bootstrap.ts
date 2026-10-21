import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import type { Env } from '../config/env.schema.js';
import { buildOpenApiDocument } from '../openapi/openapi.document.js';
import { API_PREFIX } from './api-prefix.js';

/** Interactive docs are a debug surface, so they're off in production. */
export function setupSwagger(app: INestApplication, env: Env): void {
  if (env.NODE_ENV === 'production') return;
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));
}
