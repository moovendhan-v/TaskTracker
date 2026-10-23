import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { lexicographicSortSchema, printSchema } from 'graphql';
import '../core/graphql/enums.js';
import { RESOLVERS } from '../graphql-resolvers.js';

/** Writes the schema SDL without a database or running server. */
async function main(): Promise<void> {
  const target = resolve(process.argv[2] ?? 'schema.graphql');
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false });
  await app.init();
  const schema = await app.get(GraphQLSchemaFactory).create(RESOLVERS);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${printSchema(lexicographicSortSchema(schema))}\n`);
  await app.close();
  console.log(`GraphQL schema written to ${target}`);
}

main().catch((error: unknown) => {
  console.error('GraphQL schema export failed', error);
  process.exit(1);
});
