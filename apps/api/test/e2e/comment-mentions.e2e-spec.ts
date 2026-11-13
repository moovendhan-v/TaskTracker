import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const COMMENT = 'mutation($w: ID!, $t: ID!, $body: String!) { createComment(workspaceId: $w, taskId: $t, input: { body: $body }) { id body } }';
const EDIT = 'mutation($w: ID!, $c: ID!, $body: String!) { updateComment(workspaceId: $w, commentId: $c, input: { body: $body }) { id } }';
const INBOX = 'query($w: ID!) { notifications(workspaceId: $w) { items { kind subject excerpt taskId } } }';

interface Item {
  kind: string;
  subject: string;
  excerpt: string;
  taskId: string | null;
}

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  const end = Date.now() + 5_000;
  for (;;) {
    const value = await read();
    if (accept(value) || Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** C6: @mentions in task comments reach the inbox. */
describe('comment mentions', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let sam: TestUser;
  let rio: TestUser;
  let outsider: TestUser;
  let taskId: string;
  const inbox = (user: TestUser) => user.data<{ notifications: { items: Item[] } }>(INBOX, { w }).then((data) => data.notifications.items);
  const mentions = async (user: TestUser) => (await inbox(user)).filter((item) => item.kind === 'comment_mention');

  beforeAll(async () => {
    ws = await createWorkspace('Mentions owner');
    w = ws.workspaceId;
    [sam, rio, outsider] = await Promise.all([TestUser.signUp('Sam Rivera'), TestUser.signUp('Rio Chen'), TestUser.signUp('Not a member')]);
    await addMember(ws, sam, 'Member');
    await addMember(ws, rio, 'Member');
    taskId = (await ws.owner.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Fix the invoice bug" }) { id } }', { w, l: ws.listId })).createTask.id;
  });

  it('tells the person mentioned, with names (not ids) in the excerpt', async () => {
    const body = `@{${sam.id}} can you check this? @{${outsider.id}} too`;
    const comment = (await ws.owner.data<{ createComment: { body: string } }>(COMMENT, { w, t: taskId, body })).createComment;
    // Stored as written: mentions stay tokens, rendered as names by the app.
    expect(comment.body).toBe(body);
    const [item] = await eventually(() => mentions(sam), (items) => items.length > 0);
    expect(item).toMatchObject({ kind: 'comment_mention', subject: 'Fix the invoice bug', taskId });
    expect(item!.excerpt).toBe('@Sam Rivera can you check this? @someone too');
    // Someone who isn't in the workspace is told nothing (no inbox item anywhere for them here).
    expect((await outsider.error(INBOX, { w })).code).toBe('NOT_FOUND');
  });

  it('on an edit, tells only people it newly mentions, never the author', async () => {
    const id = (await sam.data<{ createComment: { id: string } }>(COMMENT, { w, t: taskId, body: `Looking, @{${sam.id}}` })).createComment.id;
    const rioBefore = (await mentions(rio)).length;
    await sam.data(EDIT, { w, c: id, body: `Looking, @{${sam.id}} and @{${rio.id}}` });
    await eventually(() => mentions(rio), (items) => items.length > rioBefore);
    expect(await mentions(rio)).toHaveLength(rioBefore + 1);
    // Editing again with the same mentions tells nobody again.
    await sam.data(EDIT, { w, c: id, body: `Looking now, @{${sam.id}} and @{${rio.id}}` });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await mentions(rio)).toHaveLength(rioBefore + 1);
    expect((await mentions(sam)).length).toBe(1);
  });
});
