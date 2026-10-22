import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESOLVERS } from './graphql-resolvers.js';

function resolverClassNames(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return resolverClassNames(path);
    if (!entry.name.endsWith('.resolver.ts')) return [];
    return [...readFileSync(path, 'utf8').matchAll(/@Resolver\([\s\S]*?export class (\w+)/g)].map((m) => m[1] as string);
  });
}

describe('RESOLVERS', () => {
  it('lists every @Resolver class in the modules', () => {
    const declared = resolverClassNames(fileURLToPath(new URL('./modules', import.meta.url))).sort();
    expect(RESOLVERS.map((resolver) => resolver.name).sort()).toEqual(declared);
  });
});
