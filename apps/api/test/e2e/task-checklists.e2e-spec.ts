import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const LIST = 'query($w: ID!, $t: ID!) { taskChecklist(workspaceId: $w, taskId: $t) { id title done doneByName doneAt } }';
const ADD = 'mutation($w: ID!, $t: ID!, $title: String!) { addChecklistItem(workspaceId: $w, taskId: $t, title: $title) { id title done } }';
const UPDATE = 'mutation($w: ID!, $i: ID!, $input: UpdateChecklistItemInput!) { updateChecklistItem(workspaceId: $w, itemId: $i, input: $input) { title done doneByName doneAt } }';
const MOVE = 'mutation($w: ID!, $i: ID!, $b: ID) { moveChecklistItem(workspaceId: $w, itemId: $i, beforeId: $b) { title } }';
const DELETE = 'mutation($w: ID!, $i: ID!) { deleteChecklistItem(workspaceId: $w, itemId: $i) }';

interface Step {
  id: string;
  title: string;
  done: boolean;
  doneByName: string | null;
  doneAt: string | null;
}

/** C2: checklists on tasks. */
describe('task checklists', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let guest: TestUser;
  let taskId: string;
  const list = async (user: TestUser) => (await user.data<{ taskChecklist: Step[] }>(LIST, { w, t: taskId })).taskChecklist;
  const add = async (user: TestUser, title: string) => (await user.data<{ addChecklistItem: Step }>(ADD, { w, t: taskId, title })).addChecklistItem;

  beforeAll(async () => {
    ws = await createWorkspace('Checklist owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Checklist member');
    guest = await TestUser.signUp('Checklist guest');
    await addMember(ws, member, 'Member');
    await addMember(ws, guest, 'Guest');
    taskId = (await ws.owner.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Launch" }) { id } }', { w, l: ws.listId })).createTask.id;
  });

  it('adds steps in order, as one tidy line each', async () => {
    await add(ws.owner, 'Write   release notes');
    await add(ws.owner, 'Tag the build\nand push');
    await add(member, 'Tell support');
    expect((await list(guest)).map((step) => step.title)).toEqual(['Write release notes', 'Tag the build and push', 'Tell support']);
    expect((await ws.owner.error(ADD, { w, t: taskId, title: '   ' })).message).toMatch(/Write what the step is/);
  });

  it('ticks a step off, saying who and when, and can untick it', async () => {
    const [first] = await list(ws.owner);
    const ticked = (await member.data<{ updateChecklistItem: Step }>(UPDATE, { w, i: first!.id, input: { done: true } })).updateChecklistItem;
    expect(ticked).toMatchObject({ done: true, doneByName: 'Checklist member' });
    expect(ticked.doneAt).toBeTruthy();
    // Ticking again keeps who did it first.
    expect((await ws.owner.data<{ updateChecklistItem: Step }>(UPDATE, { w, i: first!.id, input: { done: true } })).updateChecklistItem.doneByName).toBe('Checklist member');
    expect((await ws.owner.data<{ updateChecklistItem: Step }>(UPDATE, { w, i: first!.id, input: { done: false } })).updateChecklistItem).toMatchObject({ done: false, doneByName: null, doneAt: null });
    expect((await ws.owner.data<{ updateChecklistItem: Step }>(UPDATE, { w, i: first!.id, input: { title: 'Write the release notes' } })).updateChecklistItem.title).toBe('Write the release notes');
  });

  it('reorders steps, and only within the task', async () => {
    const [first, , third] = await list(ws.owner);
    expect((await ws.owner.data<{ moveChecklistItem: { title: string }[] }>(MOVE, { w, i: third!.id, b: first!.id })).moveChecklistItem.map((step) => step.title)).toEqual([
      'Tell support',
      'Write the release notes',
      'Tag the build and push',
    ]);
    expect((await ws.owner.data<{ moveChecklistItem: { title: string }[] }>(MOVE, { w, i: third!.id, b: null })).moveChecklistItem.at(-1)!.title).toBe('Tell support');
    const otherTask = (await ws.owner.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Other" }) { id } }', { w, l: ws.listId })).createTask.id;
    const elsewhere = (await ws.owner.data<{ addChecklistItem: Step }>(ADD, { w, t: otherTask, title: 'Elsewhere' })).addChecklistItem;
    expect((await ws.owner.error(MOVE, { w, i: third!.id, b: elsewhere.id })).message).toMatch(/same task/);
  });

  it('lets guests read but not change it, and nobody outside the workspace', async () => {
    const [first] = await list(ws.owner);
    expect((await guest.error(ADD, { w, t: taskId, title: 'Sneaky' })).code).toBe('FORBIDDEN');
    expect((await guest.error(UPDATE, { w, i: first!.id, input: { done: true } })).code).toBe('FORBIDDEN');
    expect((await guest.error(DELETE, { w, i: first!.id })).code).toBe('FORBIDDEN');
    const other = await createWorkspace('Checklist other');
    expect((await other.owner.error(LIST, { w: other.workspaceId, t: taskId })).code).toBe('NOT_FOUND');
    expect((await other.owner.error(DELETE, { w: other.workspaceId, i: first!.id })).code).toBe('NOT_FOUND');
  });

  it('removes steps', async () => {
    const before = await list(ws.owner);
    expect((await member.data<{ deleteChecklistItem: boolean }>(DELETE, { w, i: before[0]!.id })).deleteChecklistItem).toBe(true);
    expect(await list(ws.owner)).toHaveLength(before.length - 1);
  });
});
