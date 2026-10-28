import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
}

interface List {
  id: string;
  folderId: string | null;
  name: string;
  icon: string | null;
}

const FOLDER = 'id parentId name icon color';

describe('folders, icons and docs in spaces', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let top: Folder;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const createFolder = (input: Record<string, unknown>, user?: TestUser) =>
    (user ?? ws.owner).gql<{ createFolder: Folder }>(`mutation($w: ID!, $s: ID!, $input: CreateFolderInput!) { createFolder(workspaceId: $w, spaceId: $s, input: $input) { ${FOLDER} } }`, vars({ s: ws.spaceId, input }));

  beforeAll(async () => {
    ws = await createWorkspace('Owner');
    member = await TestUser.signUp('Member');
    await addMember(ws, member, 'Member');
  });

  it('creates nested folders with icons, up to three levels', async () => {
    top = (await createFolder({ name: 'Campaigns', icon: 'megaphone', color: '#ef4444' })).data!.createFolder;
    expect(top).toMatchObject({ parentId: null, icon: 'megaphone', color: '#ef4444' });
    const middle = (await createFolder({ name: 'Q3', parentId: top.id })).data!.createFolder;
    const bottom = (await createFolder({ name: 'Launch', parentId: middle.id })).data!.createFolder;
    expect(bottom.parentId).toBe(middle.id);
    const tooDeep = await createFolder({ name: 'Too deep', parentId: bottom.id });
    expect(tooDeep.errors?.[0]?.message).toMatch(/at most 3 levels/);
  });

  it('rejects icons it does not know', async () => {
    const result = await createFolder({ name: 'Odd', icon: '<svg onload=alert(1)>' });
    expect(result.errors).toBeDefined();
  });

  it('needs list.manage to change folders', async () => {
    const result = await member.error(
      `mutation($w: ID!, $s: ID!, $input: CreateFolderInput!) { createFolder(workspaceId: $w, spaceId: $s, input: $input) { id } }`,
      vars({ s: ws.spaceId, input: { name: 'Mine' } }),
    );
    expect(result.code).toBe('FORBIDDEN');
  });

  it('creates lists in folders, moves them, and keeps them when a folder is deleted', async () => {
    const { createList } = await ws.owner.data<{ createList: List }>(
      'mutation($w: ID!, $s: ID!, $input: TaskListInput!) { createList(workspaceId: $w, spaceId: $s, input: $input) { id folderId name icon } }',
      vars({ s: ws.spaceId, input: { name: 'Ads', icon: 'target', folderId: top.id } }),
    );
    expect(createList).toMatchObject({ folderId: top.id, icon: 'target' });

    const { moveList } = await ws.owner.data<{ moveList: List }>(
      'mutation($w: ID!, $l: ID!, $input: MoveTaskListInput!) { moveList(workspaceId: $w, listId: $l, input: $input) { id folderId } }',
      vars({ l: ws.listId, input: { folderId: top.id } }),
    );
    expect(moveList.folderId).toBe(top.id);

    const { updateList } = await ws.owner.data<{ updateList: List }>(
      'mutation($w: ID!, $l: ID!, $input: UpdateTaskListInput!) { updateList(workspaceId: $w, listId: $l, input: $input) { id name icon } }',
      vars({ l: ws.listId, input: { icon: 'bug' } }),
    );
    expect(updateList).toMatchObject({ name: 'Backlog', icon: 'bug' });

    await ws.owner.data('mutation($w: ID!, $f: ID!) { deleteFolder(workspaceId: $w, folderId: $f) }', vars({ f: top.id }));
    const { lists, folders } = await ws.owner.data<{ lists: List[]; folders: Folder[] }>(
      `query($w: ID!) { lists(workspaceId: $w) { id folderId name icon } folders(workspaceId: $w) { ${FOLDER} } }`,
      vars(),
    );
    expect(lists.map((list) => list.folderId)).toEqual([null, null]);
    // The child folder moved up to the top level with its own child.
    expect(folders.find((folder) => folder.name === 'Q3')?.parentId).toBeNull();
    expect(folders).toHaveLength(2);
  });

  it('does not move a list into another project’s folder', async () => {
    const { createSpace } = await ws.owner.data<{ createSpace: { id: string } }>('mutation($w: ID!) { createSpace(workspaceId: $w, input: { name: "Sales", icon: briefcase }) { id } }', vars());
    const { createFolder: other } = await ws.owner.data<{ createFolder: Folder }>(
      `mutation($w: ID!, $s: ID!) { createFolder(workspaceId: $w, spaceId: $s, input: { name: "Leads" }) { ${FOLDER} } }`,
      vars({ s: createSpace.id }),
    );
    const result = await ws.owner.error('mutation($w: ID!, $l: ID!, $input: MoveTaskListInput!) { moveList(workspaceId: $w, listId: $l, input: $input) { id } }', vars({ l: ws.listId, input: { folderId: other.id } }));
    expect(result.message).toMatch(/its own project/);
  });

  it('puts docs in a space, and moves a page with its sub-pages to another', async () => {
    const create = 'mutation($w: ID!, $input: CreateDocumentInput!) { createDocument(workspaceId: $w, input: $input) { id spaceId icon } }';
    const { createDocument: page } = await ws.owner.data<{ createDocument: { id: string; spaceId: string; icon: string } }>(create, vars({ input: { title: 'Plan', spaceId: ws.spaceId, icon: 'book' } }));
    expect(page).toMatchObject({ spaceId: ws.spaceId, icon: 'book' });
    const { createDocument: child } = await ws.owner.data<{ createDocument: { id: string; spaceId: string } }>(create, vars({ input: { title: 'Details', parentId: page.id } }));
    expect(child.spaceId).toBe(ws.spaceId);

    await ws.owner.data('mutation($w: ID!, $d: ID!) { moveDocument(workspaceId: $w, documentId: $d, parentId: null, spaceId: null) { id } }', vars({ d: page.id }));
    const { documents } = await ws.owner.data<{ documents: { id: string; spaceId: string | null }[] }>('query($w: ID!) { documents(workspaceId: $w) { id spaceId } }', vars());
    expect(documents.filter((doc) => [page.id, child.id].includes(doc.id)).map((doc) => doc.spaceId)).toEqual([null, null]);
  });
});
