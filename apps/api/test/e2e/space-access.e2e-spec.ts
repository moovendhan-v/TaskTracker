import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE_POLICY = 'mutation($w: ID!, $input: SavePolicyInput!) { createPolicy(workspaceId: $w, input: $input) { id } }';
const ATTACH = 'mutation($w: ID!, $r: ID!, $p: String!) { attachRolePolicy(workspaceId: $w, roleId: $r, policy: $p) { id spaceRules { spaces notSpaces permissions } } }';
const DETACH = 'mutation($w: ID!, $r: ID!, $p: String!) { detachRolePolicy(workspaceId: $w, roleId: $r, policy: $p) { id } }';
const SPACES = 'query($w: ID!) { spaces(workspaceId: $w) { id name } }';
const SEARCH = 'query($w: ID!) { searchTasks(workspaceId: $w, query: { pageSize: 50 }) { total items { id title } } }';
const UPDATE_TASK = 'mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { id title } }';

describe('IAM: policies limited to spaces', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let admin: TestUser;
  let hr: { spaceId: string; listId: string; taskId: string; docId: string };
  let engineeringTaskId: string;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const policy = async (name: string, statements: unknown[]) =>
    (await ws.owner.data<{ createPolicy: { id: string } }>(CREATE_POLICY, vars({ input: { name, document: { statements } } }))).createPolicy.id;
  const spacesSeenBy = async (user: TestUser) => (await user.data<{ spaces: { name: string }[] }>(SPACES, vars())).spaces.map((space) => space.name).sort();

  beforeAll(async () => {
    ws = await createWorkspace('Space owner');
    member = await TestUser.signUp('Space member');
    admin = await TestUser.signUp('Space admin');
    await addMember(ws, member, 'Member');
    await addMember(ws, admin, 'Admin');

    const { createSpace } = await ws.owner.data<{ createSpace: { id: string } }>('mutation($w: ID!) { createSpace(workspaceId: $w, input: { name: "People ops" }) { id } }', vars());
    const { createList } = await ws.owner.data<{ createList: { id: string } }>(
      'mutation($w: ID!, $s: ID!) { createList(workspaceId: $w, spaceId: $s, input: { name: "Hiring" }) { id } }',
      vars({ s: createSpace.id }),
    );
    const { createTask } = await ws.owner.data<{ createTask: { id: string } }>(
      'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Salary review" }) { id } }',
      vars({ l: createList.id }),
    );
    const { createDocument } = await ws.owner.data<{ createDocument: { id: string } }>(
      'mutation($w: ID!, $s: ID!) { createDocument(workspaceId: $w, input: { title: "Pay bands", spaceId: $s }) { id } }',
      vars({ s: createSpace.id }),
    );
    hr = { spaceId: createSpace.id, listId: createList.id, taskId: createTask.id, docId: createDocument.id };
    const { createTask: eng } = await ws.owner.data<{ createTask: { id: string } }>(
      'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Ship it" }) { id } }',
      vars({ l: ws.listId }),
    );
    engineeringTaskId = eng.id;
  });

  it('rejects space limits on allow statements, field rules and permissions that do not apply in a space', async () => {
    const save = (statements: unknown[]) => ws.owner.error(CREATE_POLICY, vars({ input: { name: 'Bad', document: { statements } } }));
    expect((await save([{ effect: 'allow', permissions: ['task.view'], spaces: [hr.spaceId] }])).message).toMatch(/only deny statements/);
    expect((await save([{ effect: 'deny', fields: ['member.email'], spaces: [hr.spaceId] }])).message).toMatch(/needs permissions|field rules/);
    expect((await save([{ effect: 'deny', permissions: ['hr.view'], spaces: [hr.spaceId] }])).message).toMatch(/apply inside a space/);
    expect((await save([{ effect: 'deny', permissions: ['*'], spaces: [hr.spaceId], notSpaces: [ws.spaceId] }])).message).toMatch(/not both/);
  });

  it('hides a denied space everywhere: spaces, lists, tasks, search, docs and direct lookups', async () => {
    // The owner reads first, so a shared cache entry with every space exists before the member asks.
    expect(await spacesSeenBy(ws.owner)).toEqual(['Engineering', 'People ops']);
    const noHr = await policy('No People ops', [{ effect: 'deny', permissions: ['*'], spaces: [hr.spaceId] }]);
    const { attachRolePolicy } = await ws.owner.data<{ attachRolePolicy: { spaceRules: { spaces: string[] }[] } }>(ATTACH, vars({ r: ws.roles.Member, p: noHr }));
    expect(attachRolePolicy.spaceRules[0]?.spaces).toEqual([hr.spaceId]);

    expect(await spacesSeenBy(member)).toEqual(['Engineering']);
    const { lists } = await member.data<{ lists: { id: string }[] }>('query($w: ID!) { lists(workspaceId: $w) { id } }', vars());
    expect(lists.map((list) => list.id)).not.toContain(hr.listId);
    const { searchTasks } = await member.data<{ searchTasks: { items: { title: string }[] } }>(SEARCH, vars());
    expect(searchTasks.items.map((task) => task.title)).toEqual(['Ship it']);
    expect((await member.error('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { id } }', vars({ t: hr.taskId }))).code).toBe('NOT_FOUND');
    const { documents } = await member.data<{ documents: { id: string }[] }>('query($w: ID!) { documents(workspaceId: $w) { id } }', vars());
    expect(documents.map((doc) => doc.id)).not.toContain(hr.docId);
    // Writing into the hidden space fails the same way as reading it.
    const create = await member.error('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Sneaky" }) { id } }', vars({ l: hr.listId }));
    expect(create.code).toBe('NOT_FOUND');
    // Comments on a hidden task stay hidden too.
    expect((await member.error('query($w: ID!, $t: ID!) { comments(workspaceId: $w, taskId: $t) { id } }', vars({ t: hr.taskId }))).code).toBe('NOT_FOUND');
    // The workspace tells the client about the limit, so the UI can match.
    const { workspace } = await member.data<{ workspace: { spaceRules: { spaces: string[] }[] } }>('query($w: ID!) { workspace(workspaceId: $w) { spaceRules { spaces } } }', vars());
    expect(workspace.spaceRules).toEqual([{ spaces: [hr.spaceId] }]);

    // Everyone else still sees it, and the owner's cached answer is unchanged.
    expect(await spacesSeenBy(ws.owner)).toEqual(['Engineering', 'People ops']);
    expect(await spacesSeenBy(admin)).toEqual(['Engineering', 'People ops']);
    await ws.owner.data(DETACH, vars({ r: ws.roles.Member, p: noHr }));
    expect(await spacesSeenBy(member)).toEqual(['Engineering', 'People ops']);
  });

  it('makes every other space read-only with notSpaces', async () => {
    const readOnlyElsewhere = await policy('Edit Engineering only', [{ effect: 'deny', permissions: ['task.update', 'task.create', 'task.delete'], notSpaces: [ws.spaceId] }]);
    await ws.owner.data(ATTACH, vars({ r: ws.roles.Member, p: readOnlyElsewhere }));

    expect(await spacesSeenBy(member)).toEqual(['Engineering', 'People ops']);
    const { updateTask } = await member.data<{ updateTask: { title: string } }>(UPDATE_TASK, vars({ t: engineeringTaskId, input: { title: 'Ship it today' } }));
    expect(updateTask.title).toBe('Ship it today');
    const denied = await member.error(UPDATE_TASK, vars({ t: hr.taskId, input: { title: 'Changed' } }));
    expect(denied.code).toBe('FORBIDDEN');
    expect(denied.message).toMatch(/task.update in this space/);
    await ws.owner.data(DETACH, vars({ r: ws.roles.Member, p: readOnlyElsewhere }));
  });

  it("doesn't let someone kept out of a space build or hand out a role that can see it", async () => {
    const noHr = await policy('Admins: no People ops', [{ effect: 'deny', permissions: ['*'], spaces: [hr.spaceId] }]);
    await ws.owner.data(ATTACH, vars({ r: ws.roles.Admin, p: noHr }));
    expect(await spacesSeenBy(admin)).toEqual(['Engineering']);

    const createRole = await admin.error('mutation($w: ID!) { createRole(workspaceId: $w, input: { name: "Viewer", permissions: ["task.view"] }) { id } }', vars());
    expect(createRole.message).toMatch(/reach spaces you are kept out of/);
    // Handing out the unrestricted Member role would do the same.
    const outsider = await TestUser.signUp('Space outsider');
    const add = await admin.error('mutation($w: ID!, $input: AddMemberInput!) { addMember(workspaceId: $w, input: $input) { message } }', vars({ input: { email: outsider.email, roleId: ws.roles.Member } }));
    expect(add.message).toMatch(/reach spaces you are kept out of/);
    // Taking the limit off its own role is lifting a deny, which the admin can't do either.
    expect((await admin.error(DETACH, vars({ r: ws.roles.Admin, p: noHr }))).code).toBe('FORBIDDEN');
    await ws.owner.data(DETACH, vars({ r: ws.roles.Admin, p: noHr }));
  });
});
