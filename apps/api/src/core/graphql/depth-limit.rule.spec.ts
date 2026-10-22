import { buildSchema, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { depthLimitRule } from './depth-limit.rule.js';

const schema = buildSchema(`
  type Node { id: ID! child: Node name: String }
  type Query { node: Node }
`);

const errorsFor = (query: string, max: number) => validate(schema, parse(query), [depthLimitRule(max)]).map((e) => e.message);

describe('depthLimitRule', () => {
  it('allows queries within the limit', () => {
    expect(errorsFor('{ node { child { name } } }', 3)).toEqual([]);
  });

  it('rejects queries past the limit', () => {
    expect(errorsFor('{ node { child { child { name } } } }', 3)).toEqual(['Query is 4 levels deep; the limit is 3']);
  });

  it('counts depth through fragments and inline fragments', () => {
    const query = `
      query { node { ...Deep } }
      fragment Deep on Node { child { ... on Node { child { name } } } }
    `;
    expect(errorsFor(query, 3)).toEqual(['Query is 4 levels deep; the limit is 3']);
  });

  it('ignores introspection fields', () => {
    expect(errorsFor('{ __schema { types { fields { type { ofType { name } } } } } }', 2)).toEqual([]);
  });
});
