import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace } from './support/fixtures.js';

const CREATE_POLICY = 'mutation($w: ID!, $input: SavePolicyInput!) { createPolicy(workspaceId: $w, input: $input) { id } }';
const ATTACH = 'mutation($w: ID!, $r: ID!, $p: String!) { attachRolePolicy(workspaceId: $w, roleId: $r, policy: $p) { id } }';

describe('refusals say which permission is missing', () => {
  it('names the workspace permission, or the permission and project, the caller lacks', async () => {
    const ws = await createWorkspace('Why owner');
    const w = ws.workspaceId;
    const guest = await TestUser.signUp('Why guest');
    const member = await TestUser.signUp('Why member');
    await addMember(ws, guest, 'Guest');
    await addMember(ws, member, 'Member');

    // A workspace permission: the guest can't create tasks.
    const create = await guest.error('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Nope" }) { id } }', { w, l: ws.listId });
    expect(create.code).toBe('FORBIDDEN');
    expect(create.extensions).toMatchObject({ missingPermission: 'task.create' });
    expect(create.extensions['spaceId']).toBeUndefined();

    // A space-limited one: the member may create tasks, but not in this project.
    const { createPolicy } = await ws.owner.data<{ createPolicy: { id: string } }>(CREATE_POLICY, { w, input: { name: 'No creating here', document: { statements: [{ effect: 'deny', permissions: ['task.create'], spaces: [ws.spaceId] }] } } });
    await ws.owner.data(ATTACH, { w, r: ws.roles.Member, p: createPolicy.id });
    const inSpace = await member.error('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Nope" }) { id } }', { w, l: ws.listId });
    expect(inSpace.code).toBe('FORBIDDEN');
    expect(inSpace.extensions).toMatchObject({ missingPermission: 'task.create', spaceId: ws.spaceId });

    // Other refusals don't claim a permission.
    const notFound = await guest.error('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { id } }', { w, t: '00000000-0000-4000-8000-000000000000' });
    expect(notFound.extensions['missingPermission']).toBeUndefined();
  });
});
