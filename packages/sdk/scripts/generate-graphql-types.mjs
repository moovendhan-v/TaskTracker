// Generates TypeScript types for every GraphQL type, input and enum in schema.graphql.
// Uses @graphql-codegen/core directly: the codegen CLI pulls in micromatch -> braces,
// which has an unpatched high-severity advisory (GHSA-vfj7-8cjw-p6xm).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codegen } from '@graphql-codegen/core';
import * as typescriptPlugin from '@graphql-codegen/typescript';
import { buildSchema, parse, printSchema } from 'graphql';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = resolve(root, 'schema.graphql');
const outputPath = resolve(root, 'src/generated/graphql.ts');

const schema = buildSchema(await readFile(schemaPath, 'utf8'));

const output = await codegen({
  filename: outputPath,
  schema: parse(printSchema(schema)),
  schemaAst: schema,
  documents: [],
  plugins: [{ typescript: {} }],
  pluginMap: { typescript: typescriptPlugin },
  config: {
    enumsAsTypes: true,
    avoidOptionals: { field: true, inputValue: false, object: true },
    scalars: { ID: 'string', JSONObject: 'Record<string, unknown>' },
    useTypeImports: true,
  },
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
console.log(`GraphQL types written to ${outputPath}`);
