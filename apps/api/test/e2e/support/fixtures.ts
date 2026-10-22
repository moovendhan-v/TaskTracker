import { TestUser } from './api-client.js';

export interface WorkspaceFixture {
  owner: TestUser;
  workspaceId: string;
  spaceId: string;
  listId: string;
  roles: Record<'Owner' | 'Admin' | 'Member' | 'Guest', string>;
}

/** A signed-up owner with a workspace, one space and one list. */
export async function createWorkspace(ownerName = 'Owner', workspaceName = 'Acme'): Promise<WorkspaceFixture> {
  const owner = await TestUser.signUp(ownerName);
  const { createWorkspace } = await owner.data<{ createWorkspace: { id: string } }>(
    'mutation($input: CreateWorkspaceInput!) { createWorkspace(input: $input) { id } }',
    { input: { name: workspaceName } },
  );
  const workspaceId = createWorkspace.id;
  const { createSpace } = await owner.data<{ createSpace: { id: string } }>(
    'mutation($w: ID!) { createSpace(workspaceId: $w, input: { name: "Engineering" }) { id } }',
    { w: workspaceId },
  );
  const { createList } = await owner.data<{ createList: { id: string } }>(
    'mutation($w: ID!, $s: ID!) { createList(workspaceId: $w, spaceId: $s, input: { name: "Backlog" }) { id } }',
    { w: workspaceId, s: createSpace.id },
  );
  const { roles } = await owner.data<{ roles: { id: string; name: string }[] }>('query($w: ID!) { roles(workspaceId: $w) { id name } }', {
    w: workspaceId,
  });
  const byName = Object.fromEntries(roles.map((role) => [role.name, role.id])) as WorkspaceFixture['roles'];
  return { owner, workspaceId, spaceId: createSpace.id, listId: createList.id, roles: byName };
}

/** Adds an existing user to the fixture's workspace with a built-in role. */
export async function addMember(fixture: WorkspaceFixture, user: TestUser, role: keyof WorkspaceFixture['roles']): Promise<void> {
  await fixture.owner.data('mutation($w: ID!, $input: AddMemberInput!) { addMember(workspaceId: $w, input: $input) { message } }', {
    w: fixture.workspaceId,
    input: { email: user.email, roleId: fixture.roles[role] },
  });
}
