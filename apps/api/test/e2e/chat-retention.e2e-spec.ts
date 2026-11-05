import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE = 'mutation($w: ID!, $input: CreateChatChannelInput!) { createChatChannel(workspaceId: $w, input: $input) { id } }';
const JOIN = 'mutation($w: ID!, $c: ID!) { joinChatChannel(workspaceId: $w, channelId: $c) { id } }';
const SEND = 'mutation($w: ID!, $input: SendChatMessageInput!) { sendChatMessage(workspaceId: $w, input: $input) { id } }';
const MESSAGES = 'query($w: ID!, $c: ID!) { chatMessages(workspaceId: $w, channelId: $c) { items { id body } } }';
const RETENTION = 'query($w: ID!) { chatRetention(workspaceId: $w) { days } }';
const SET_RETENTION = 'mutation($w: ID!, $d: Int) { setChatRetention(workspaceId: $w, days: $d) { days } }';
const AUDIT = 'query($w: ID!, $q: ResourceQueryInput) { searchWorkspaceAuditLog(workspaceId: $w, query: $q) { items { action metadata } } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id number } }';
const ABOUT = 'query($w: ID!, $t: ID!) { taskChatMessages(workspaceId: $w, taskId: $t) { channelName channelKind message { body kind } } }';

async function eventually<T>(check: () => Promise<T | undefined>, timeoutMs = 15_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > until) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

describe('chat retention and chat about a task', () => {
  const pool = runtimeDatabase();
  let ws: WorkspaceFixture;
  let member: TestUser;
  let w: string;
  let general: string;
  const send = async (user: TestUser, channelId: string, body: string, parentId?: string) =>
    (await user.data<{ sendChatMessage: { id: string } }>(SEND, { w, input: { channelId, body, parentId } })).sendChatMessage.id;
  const bodies = async (channelId: string) => (await ws.owner.data<{ chatMessages: { items: { body: string }[] } }>(MESSAGES, { w, c: channelId })).chatMessages.items.map((item) => item.body).sort();
  /** A message written `days` ago, committed (as its author, through row-level security). */
  const oldMessage = async (user: TestUser, channelId: string, body: string, days: number, parentId: string | null = null) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.workspace_id', $1, true), set_config('app.user_id', $2, true)", [w, user.id]);
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO chat_message (workspace_id, channel_id, author_id, parent_id, body, created_at) VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6)) RETURNING id`,
        [w, channelId, user.id, parentId, body, days],
      );
      await client.query('COMMIT');
      return rows[0]!.id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    ws = await createWorkspace('Retention owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Retention member');
    await addMember(ws, member, 'Member');
    general = (await ws.owner.data<{ createChatChannel: { id: string } }>(CREATE, { w, input: { name: 'general', kind: 'public' } })).createChatChannel.id;
    await member.data(JOIN, { w, c: general });
  });

  afterAll(() => pool.end());

  it('lets only workspace managers set how long chat is kept, and audits it', async () => {
    expect((await member.data<{ chatRetention: { days: number | null } }>(RETENTION, { w })).chatRetention.days).toBeNull();
    expect((await member.error(SET_RETENTION, { w, d: 30 })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(SET_RETENTION, { w, d: 7 })).code).toBe('BAD_USER_INPUT');
    expect((await ws.owner.data<{ setChatRetention: { days: number } }>(SET_RETENTION, { w, d: 90 })).setChatRetention.days).toBe(90);
    expect((await ws.owner.data<{ setChatRetention: { days: number | null } }>(SET_RETENTION, { w, d: null })).setChatRetention.days).toBeNull();
    const audit = (await ws.owner.data<{ searchWorkspaceAuditLog: { items: { action: string; metadata: Record<string, unknown> }[] } }>(AUDIT, { w, q: { where: 'action=chat.retention.update' } })).searchWorkspaceAuditLog.items;
    expect(audit.map((entry) => entry.metadata['days'])).toEqual(expect.arrayContaining([90, null]));
  });

  it('removes whole threads once their last message is past the retention, and nothing newer', async () => {
    const oldRoot = await oldMessage(member, general, 'Old news', 45);
    await oldMessage(ws.owner, general, 'Old reply', 44, oldRoot);
    const liveRoot = await oldMessage(member, general, 'Old start, live thread', 60);
    await send(ws.owner, general, 'A fresh reply keeps the thread', liveRoot);
    await send(member, general, 'Today');
    await oldMessage(member, general, 'Just inside', 20);
    expect(await bodies(general)).toEqual(['Just inside', 'Old news', 'Old start, live thread', 'Today']);

    // Nobody can delete messages for real, not even their author: only the sweep (platform scope) can.
    const deleted = await withScope(pool, { workspaceId: w, userId: member.id }, async (client) => (await client.query('DELETE FROM chat_message WHERE id = $1', [oldRoot])).rowCount);
    expect(deleted).toBe(0);

    await ws.owner.data(SET_RETENTION, { w, d: 30 });
    const left = await eventually(async () => {
      const now = await bodies(general);
      return now.includes('Old news') ? undefined : now;
    });
    expect(left).toEqual(['Just inside', 'Old start, live thread', 'Today']);
    // The replies went with their thread.
    const replies = await withScope(pool, { workspaceId: w, userId: member.id }, async (client) => (await client.query('SELECT count(*)::int AS n FROM chat_message WHERE parent_id = $1', [oldRoot])).rows[0].n);
    expect(replies).toBe(0);
    await ws.owner.data(SET_RETENTION, { w, d: null });
  });

  it('lists where a task was discussed, only in channels the reader can read', async () => {
    const task = (await ws.owner.data<{ createTask: { id: string; number: number } }>(CREATE_TASK, { w, l: ws.listId, input: { title: 'Launch checklist' } })).createTask;
    const n = task.number;
    const secret = (await member.data<{ createChatChannel: { id: string } }>(CREATE, { w, input: { name: 'member-room', kind: 'private' } })).createChatChannel.id;
    await send(member, general, `Is #${n} ready for review?`);
    await send(member, general, `Not this one: #${n}0 or #${n * 10 + 1}`);
    await send(member, general, `:::task ${n}`);
    await send(member, secret, `Between us: #${n} slipped`);

    const seen = async (user: TestUser) => (await user.data<{ taskChatMessages: { channelName: string; message: { body: string } }[] }>(ABOUT, { w, t: task.id })).taskChatMessages;
    expect((await seen(member)).map((hit) => `${hit.channelName}: ${hit.message.body}`)).toEqual([`member-room: Between us: #${n} slipped`, `general: :::task ${n}`, `general: Is #${n} ready for review?`]);
    // The owner isn't in the private channel, so it isn't there for them.
    expect((await seen(ws.owner)).map((hit) => hit.channelName)).toEqual(['general', 'general']);
    const outsider = await TestUser.signUp('Not in workspace');
    // Someone outside the workspace doesn't even learn it exists.
    expect((await outsider.error(ABOUT, { w, t: task.id })).code).toBe('NOT_FOUND');
  });
});
