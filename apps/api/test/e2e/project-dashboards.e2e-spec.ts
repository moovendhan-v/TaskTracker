import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace } from './support/fixtures.js';

const LIST = 'query($w: ID!, $s: ID) { dashboards(workspaceId: $w, spaceId: $s) { id name spaceId mine items { type } } }';
const CREATE = 'mutation($w: ID!, $input: CreateDashboardInput!) { createDashboard(workspaceId: $w, input: $input) { id spaceId items { type } } }';
const SAVE = 'mutation($w: ID!, $d: ID!, $input: SaveDashboardLayoutInput!) { saveDashboardLayout(workspaceId: $w, dashboardId: $d, input: $input) { version items { type } } }';
const CREATE_POLICY = 'mutation($w: ID!, $input: SavePolicyInput!) { createPolicy(workspaceId: $w, input: $input) { id } }';
const ATTACH = 'mutation($w: ID!, $r: ID!, $p: String!) { attachRolePolicy(workspaceId: $w, roleId: $r, policy: $p) { id } }';

type Listed = { id: string; name: string; spaceId: string | null; mine: boolean; items: { type: string }[] };

describe('dashboards on project pages', () => {
  it('keeps project dashboards on their project, with project blocks, for people who can see it', async () => {
    const ws = await createWorkspace('Project dashboards');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Project dashboards member');
    await addMember(ws, member, 'Member');
    const { createSpace } = await ws.owner.data<{ createSpace: { id: string } }>('mutation($w: ID!) { createSpace(workspaceId: $w, input: { name: "Secret project" }) { id } }', { w });
    const project = ws.spaceId;

    // A project dashboard starts from the project's blocks, and only takes project blocks.
    const health = (await ws.owner.data<{ createDashboard: { id: string; spaceId: string; items: { type: string }[] } }>(CREATE, { w, input: { name: 'Delivery health', visibility: 'workspace', spaceId: project } })).createDashboard;
    expect(health.spaceId).toBe(project);
    expect(health.items.map((item) => item.type)).toContain('project-status');
    expect((await ws.owner.error(SAVE, { w, d: health.id, input: { baseVersion: 1, items: [{ id: 'k', type: 'my-tasks', x: 0, y: 0, w: 6, h: 4 }] } })).message).toMatch(/unknown block type/);
    expect((await ws.owner.data<{ saveDashboardLayout: { version: number } }>(SAVE, { w, d: health.id, input: { baseVersion: 1, items: [{ id: 'k', type: 'kpis', x: 0, y: 0, w: 12, h: 3 }] } })).saveDashboardLayout.version).toBe(2);
    const home = (await ws.owner.data<{ createDashboard: { id: string } }>(CREATE, { w, input: { name: 'Home stats' } })).createDashboard;

    // Each page lists its own: Home's don't show on the project, nor the project's on Home or another project.
    const list = async (user: TestUser, spaceId: string | null) => (await user.data<{ dashboards: Listed[] }>(LIST, { w, s: spaceId })).dashboards.map((item) => item.name);
    expect(await list(ws.owner, null)).toEqual(['Home stats']);
    expect(await list(ws.owner, project)).toEqual(['Delivery health']);
    expect(await list(ws.owner, createSpace.id)).toEqual([]);
    expect(await list(member, project)).toEqual(['Delivery health']);
    expect(home.id).not.toBe(health.id);

    // Someone kept out of the project neither sees its dashboards nor can add one there.
    const secret = (await ws.owner.data<{ createDashboard: { id: string } }>(CREATE, { w, input: { name: 'Secret board', visibility: 'workspace', spaceId: createSpace.id } })).createDashboard;
    expect(secret.id).toBeTruthy();
    const { createPolicy } = await ws.owner.data<{ createPolicy: { id: string } }>(CREATE_POLICY, { w, input: { name: 'No secret project', document: { statements: [{ effect: 'deny', permissions: ['*'], spaces: [createSpace.id] }] } } });
    await ws.owner.data(ATTACH, { w, r: ws.roles.Member, p: createPolicy.id });
    expect((await member.error(LIST, { w, s: createSpace.id })).code).toMatch(/NOT_FOUND|FORBIDDEN/);
    expect((await member.error(CREATE, { w, input: { name: 'Mine', spaceId: createSpace.id } })).code).toMatch(/NOT_FOUND|FORBIDDEN/);
    expect(await list(member, project)).toEqual(['Delivery health']);

    // Another workspace can't reach the project at all.
    const other = await createWorkspace('Project dashboards outsider');
    expect((await other.owner.error(LIST, { w: other.workspaceId, s: project })).code).toBe('NOT_FOUND');
  });
});
