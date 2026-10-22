import { describe, expect, it } from 'vitest';
import { PASSWORD, TestUser, uniqueEmail } from './support/api-client.js';
import { createWorkspace } from './support/fixtures.js';

describe('authentication', () => {
  it('rejects operations without a session', async () => {
    const anonymous = new TestUser('Anonymous');
    expect((await anonymous.error('{ workspaces { id } }')).code).toBe('UNAUTHENTICATED');
  });

  it('returns the signed-in user', async () => {
    const user = await TestUser.signUp('Alice');
    const { me } = await user.data<{ me: { email: string; platformRole: string } }>('{ me { email platformRole } }');
    expect(me).toEqual({ email: user.email, platformRole: 'USER' });
  });

  it('ignores platformRole sent at sign-up (mass assignment)', async () => {
    const user = new TestUser('Mallory');
    await user.auth('sign-up/email', { name: 'Mallory', email: user.email, password: PASSWORD, platformRole: 'SUPER_ADMIN' });
    const { me } = await user.data<{ me: { platformRole: string } }>('{ me { platformRole } }');
    expect(me.platformRole).toBe('USER');
  });

  it('rate limits sign-up per IP', async () => {
    const ip = `10.255.${Date.now() % 250}.${Math.floor(Math.random() * 250) + 1}`;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const user = new TestUser('Burst', uniqueEmail('burst'), ip);
      statuses.push((await user.auth('sign-up/email', { name: 'Burst', email: user.email, password: PASSWORD })).status);
    }
    expect(statuses.slice(0, 3).every((status) => status === 200)).toBe(true);
    expect(statuses[3]).toBe(429);
  });

  it('signs out and stops accepting the old session', async () => {
    const user = await TestUser.signUp('Leaver');
    expect((await user.auth('sign-out', {})).ok).toBe(true);
    expect((await user.error('{ me { id } }')).code).toBe('UNAUTHENTICATED');
  });
});

describe('tenant isolation', () => {
  it('lists only the workspaces you belong to', async () => {
    const a = await createWorkspace('Owner A', 'Alpha');
    const b = await createWorkspace('Owner B', 'Beta');
    const { workspaces } = await a.owner.data<{ workspaces: { id: string; roleName: string }[] }>('{ workspaces { id roleName } }');
    expect(workspaces).toEqual([{ id: a.workspaceId, roleName: 'Owner' }]);
    expect(workspaces.map((workspace) => workspace.id)).not.toContain(b.workspaceId);
  });

  it("answers NOT_FOUND for another tenant's workspace and records", async () => {
    const a = await createWorkspace('Owner A');
    const outsider = await TestUser.signUp('Outsider');
    const { createTask } = await a.owner.data<{ createTask: { id: string } }>(
      'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Secret" }) { id } }',
      { w: a.workspaceId, l: a.listId },
    );

    expect((await outsider.error('query($w: ID!) { workspace(workspaceId: $w) { id } }', { w: a.workspaceId })).code).toBe('NOT_FOUND');
    expect((await outsider.error('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { id } }', { w: a.workspaceId, t: createTask.id })).code).toBe(
      'NOT_FOUND',
    );
    const deleted = await outsider.error('mutation($w: ID!, $t: ID!) { deleteTask(workspaceId: $w, taskId: $t) }', { w: a.workspaceId, t: createTask.id });
    expect(deleted.code).toBe('NOT_FOUND');
  });

  it("can't reach another workspace's record through your own workspace id", async () => {
    const a = await createWorkspace('Owner A');
    const b = await createWorkspace('Owner B');
    const { createTask } = await b.owner.data<{ createTask: { id: string } }>(
      'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "B only" }) { id } }',
      { w: b.workspaceId, l: b.listId },
    );
    const result = await a.owner.error('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { id } }', { w: a.workspaceId, t: createTask.id });
    expect(result.code).toBe('NOT_FOUND');
  });
});
