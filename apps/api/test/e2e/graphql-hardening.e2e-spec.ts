import { beforeAll, describe, expect, it } from 'vitest';
import { rawGraphql, TestUser } from './support/api-client.js';
import { createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

// The depth limit is covered by src/core/graphql/depth-limit.rule.spec.ts: the schema's types are
// flat, so no valid operation against it gets deep enough to hit the limit.
describe('GraphQL hardening', () => {
  let ws: WorkspaceFixture;

  beforeAll(async () => {
    ws = await createWorkspace('Hardening');
  });

  it('rejects alias amplification by cost', async () => {
    const aliases = Array.from({ length: 60 }, (_, i) => `t${i}: tasks(workspaceId: $w, listId: $l, pageSize: 100) { items { id title } }`).join(' ');
    const result = await ws.owner.error(`query($w: ID!, $l: ID!) { ${aliases} }`, { w: ws.workspaceId, l: ws.listId });
    expect(result.code).toBe('QUERY_TOO_COMPLEX');
  });

  it('allows a normal page within the cost budget', async () => {
    const { tasks } = await ws.owner.data<{ tasks: { total: number } }>(
      'query($w: ID!, $l: ID!) { tasks(workspaceId: $w, listId: $l, pageSize: 100) { total items { id title } } }',
      { w: ws.workspaceId, l: ws.listId },
    );
    expect(tasks.total).toBe(0);
  });

  it('stops parsing oversized documents', async () => {
    const huge = `{ ${Array.from({ length: 700 }, () => 'me { id }').join(' ')} }`;
    expect((await ws.owner.error(huge)).message).toMatch(/more that 2000 tokens|more than 2000 tokens/);
  });

  it('does not accept batched requests', async () => {
    const response = await rawGraphql({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ query: '{ me { id } }' }, { query: '{ me { id } }' }]),
    });
    expect(response.status).toBe(400);
  });

  it('blocks simple cross-site requests (CSRF prevention)', async () => {
    const response = await rawGraphql({
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ query: '{ me { id } }' }),
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toMatch(/CSRF|preflight/i);
  });

  it('does not serve REST routes or API docs', async () => {
    const base = new TestUser('Probe').baseUrl;
    for (const path of ['/api/workspaces', '/api/me', '/api/docs', '/api/docs-json']) {
      expect((await fetch(`${base}${path}`)).status, path).toBe(404);
    }
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ status: 'ok' });
  });

  it('keeps errors generic and free of stack traces', async () => {
    const result = await ws.owner.gql('query($w: ID!) { workspace(workspaceId: $w) { id } }', { w: 'not-a-uuid' });
    expect(JSON.stringify(result.errors)).not.toMatch(/stacktrace|at .*\.js:\d+/i);
  });
});
