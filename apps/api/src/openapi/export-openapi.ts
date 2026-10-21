import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { buildOpenApiDocument } from './swagger.js';

/**
 * Writes the OpenAPI document without connecting to the database: preview mode
 * builds the module graph but doesn't instantiate providers.
 */
async function main(): Promise<void> {
  const target = resolve(process.argv[2] ?? 'openapi.json');
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  app.setGlobalPrefix('api');
  const document = buildOpenApiDocument(app);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI document written to ${target}`);
}

main().catch((error: unknown) => {
  console.error('OpenAPI export failed', error);
  process.exit(1);
});
