import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

export const SESSION_COOKIE = 'better-auth.session_token';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('TaskFlow API')
    .setDescription('Work management API: workspaces, roles, spaces, lists and tasks.')
    .setVersion('0.1.0')
    .addCookieAuth(SESSION_COOKIE)
    .build();
  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}
