import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

/**
 * Chat row-level security, checked in the database as the API's runtime role
 * (no service code involved): private channels and DMs are invisible to
 * non-members, only members post, only authors edit, and roles can't be self-granted.
 */
describe('chat row-level security', () => {
  const db = runtimeDatabase();
  let ws: WorkspaceFixture;
  let other: WorkspaceFixture;
  let member: TestUser;
  let outsider: TestUser;
  let publicId: string;
  let privateId: string;
  let dmId: string;

  /** Runs one statement as a user in a workspace and commits it. */
  async function as<T extends pg.QueryResultRow>(userId: string, workspaceId: string, sql: string, params: unknown[] = []): Promise<T[]> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.workspace_id', $1, true), set_config('app.user_id', $2, true), set_config('app.scope', '', true)", [workspaceId, userId]);
      const { rows } = await client.query<T>(sql, params);
      await client.query('COMMIT');
      return rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const newChannel = async (userId: string, kind: string, name: string | null, dmKey: string | null = null) => {
    const [row] = await as<{ id: string }>(userId, ws.workspaceId, 'INSERT INTO chat_channel (workspace_id, kind, name, dm_key, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
      ws.workspaceId,
      kind,
      name,
      dmKey,
      userId,
    ]);
    await as(userId, ws.workspaceId, "INSERT INTO chat_member (channel_id, user_id, workspace_id, role) VALUES ($1, $2, $3, 'owner')", [row!.id, userId, ws.workspaceId]);
    return row!.id;
  };
  const post = (userId: string, channelId: string, body: string, parentId: string | null = null) =>
    as<{ id: string }>(userId, ws.workspaceId, 'INSERT INTO chat_message (workspace_id, channel_id, author_id, body, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
      ws.workspaceId,
      channelId,
      userId,
      body,
      parentId,
    ]);
  const channelsSeenBy = async (userId: string) =>
    (await as<{ id: string }>(userId, ws.workspaceId, 'SELECT id FROM chat_channel')).map((row) => row.id).sort();
  const bodiesSeenBy = async (userId: string) =>
    (await as<{ body: string }>(userId, ws.workspaceId, 'SELECT body FROM chat_message ORDER BY created_at')).map((row) => row.body);

  beforeAll(async () => {
    ws = await createWorkspace('Chat RLS owner');
    other = await createWorkspace('Chat RLS other');
    member = await TestUser.signUp('Chat RLS member');
    outsider = await TestUser.signUp('Chat RLS teammate');
    await addMember(ws, member, 'Member');
    await addMember(ws, outsider, 'Member');
    const owner = ws.owner.id;
    publicId = await newChannel(owner, 'public', 'general');
    privateId = await newChannel(owner, 'private', 'leads');
    dmId = await newChannel(owner, 'dm', null, [owner, member.id].sort().join(','));
    await as(owner, ws.workspaceId, "INSERT INTO chat_member (channel_id, user_id, workspace_id) VALUES ($1, $2, $3), ($4, $2, $3)", [privateId, member.id, ws.workspaceId, dmId]);
    await post(owner, publicId, 'hello everyone');
    await post(owner, privateId, 'leads only');
    await post(member.id, dmId, 'just us');
  });

  afterAll(() => db.end());

  it('hides private channels and DMs, and their messages, from non-members', async () => {
    expect(await channelsSeenBy(outsider.id)).toEqual([publicId]);
    expect(await bodiesSeenBy(outsider.id)).toEqual(['hello everyone']);
    expect(await channelsSeenBy(member.id)).toEqual([publicId, privateId, dmId].sort());
    expect(await bodiesSeenBy(member.id)).toEqual(['hello everyone', 'leads only', 'just us']);
  });

  it("shows nothing to another workspace or without a scope", async () => {
    expect(await as(other.owner.id, other.workspaceId, 'SELECT id FROM chat_channel UNION ALL SELECT id FROM chat_message')).toEqual([]);
    const { rows } = await db.query('SELECT id FROM chat_channel UNION ALL SELECT id FROM chat_message');
    expect(rows).toEqual([]);
  });

  it('lets only members post, and only into open channels', async () => {
    await expect(post(outsider.id, publicId, 'not joined yet')).rejects.toThrow(/row-level security/);
    await expect(post(outsider.id, privateId, 'sneaking in')).rejects.toThrow(/row-level security/);
    // Posting as someone else is refused too.
    await expect(as(member.id, ws.workspaceId, 'INSERT INTO chat_message (workspace_id, channel_id, author_id, body) VALUES ($1, $2, $3, $4)', [ws.workspaceId, publicId, ws.owner.id, 'x'])).rejects.toThrow(/row-level security/);
    // Joining a public channel works for yourself, as a plain member only.
    await expect(as(outsider.id, ws.workspaceId, "INSERT INTO chat_member (channel_id, user_id, workspace_id, role) VALUES ($1, $2, $3, 'owner')", [publicId, outsider.id, ws.workspaceId])).rejects.toThrow(/row-level security/);
    await as(outsider.id, ws.workspaceId, 'INSERT INTO chat_member (channel_id, user_id, workspace_id) VALUES ($1, $2, $3)', [publicId, outsider.id, ws.workspaceId]);
    await post(outsider.id, publicId, 'joined');
    // …but not a private one, and nobody but its owner adds people to it.
    await expect(as(outsider.id, ws.workspaceId, 'INSERT INTO chat_member (channel_id, user_id, workspace_id) VALUES ($1, $2, $3)', [privateId, outsider.id, ws.workspaceId])).rejects.toThrow(/row-level security/);
    await expect(as(member.id, ws.workspaceId, 'INSERT INTO chat_member (channel_id, user_id, workspace_id) VALUES ($1, $2, $3)', [privateId, outsider.id, ws.workspaceId])).rejects.toThrow(/row-level security/);
    // A creator can only seed an empty channel with themselves.
    const [late] = await as<{ id: string }>(outsider.id, ws.workspaceId, "INSERT INTO chat_channel (workspace_id, kind, name, created_by) VALUES ($1, 'private', 'late', $2) RETURNING id", [ws.workspaceId, outsider.id]);
    await expect(as(outsider.id, ws.workspaceId, "INSERT INTO chat_member (channel_id, user_id, workspace_id, role) VALUES ($1, $2, $3, 'owner')", [late!.id, member.id, ws.workspaceId])).rejects.toThrow(/row-level security/);
    // Archived channels take no new posts.
    await as(ws.owner.id, ws.workspaceId, 'UPDATE chat_channel SET archived_at = now() WHERE id = $1', [privateId]);
    await expect(post(member.id, privateId, 'too late')).rejects.toThrow(/row-level security/);
    await as(ws.owner.id, ws.workspaceId, 'UPDATE chat_channel SET archived_at = NULL WHERE id = $1', [privateId]);
  });

  it('lets only the author edit a message, and only its body', async () => {
    const [mine] = await post(member.id, privateId, 'typo');
    const edited = await as(ws.owner.id, ws.workspaceId, "UPDATE chat_message SET body = 'hijacked' WHERE id = $1 RETURNING id", [mine!.id]);
    expect(edited).toEqual([]);
    await expect(as(member.id, ws.workspaceId, 'UPDATE chat_message SET channel_id = $2 WHERE id = $1', [mine!.id, publicId])).rejects.toThrow(/only the body/);
    expect(await as(member.id, ws.workspaceId, "UPDATE chat_message SET body = 'fixed', edited_at = now() WHERE id = $1 RETURNING id", [mine!.id])).toHaveLength(1);
    // Nobody hard-deletes messages.
    expect(await as(member.id, ws.workspaceId, 'DELETE FROM chat_message WHERE id = $1 RETURNING id', [mine!.id])).toEqual([]);
  });

  it('keeps threads one level deep and inside their channel', async () => {
    const [root] = await post(ws.owner.id, privateId, 'root');
    const [reply] = await post(member.id, privateId, 'reply', root!.id);
    await expect(post(member.id, privateId, 'reply to a reply', reply!.id)).rejects.toThrow(/top of the same channel/);
    await expect(post(ws.owner.id, publicId, 'cross-channel', root!.id)).rejects.toThrow(/top of the same channel/);
  });

  it("doesn't let members promote themselves or touch other people's read state", async () => {
    await expect(as(member.id, ws.workspaceId, "UPDATE chat_member SET role = 'owner' WHERE channel_id = $1 AND user_id = $2", [privateId, member.id])).rejects.toThrow(/only a channel owner/);
    expect(await as(member.id, ws.workspaceId, 'UPDATE chat_member SET muted = true WHERE channel_id = $1 AND user_id = $2 RETURNING user_id', [privateId, ws.owner.id])).toEqual([]);
    await expect(as(ws.owner.id, ws.workspaceId, 'UPDATE chat_member SET last_read_at = now() WHERE channel_id = $1 AND user_id = $2', [privateId, member.id])).rejects.toThrow(/personal/);
    expect(await as(member.id, ws.workspaceId, 'UPDATE chat_member SET last_read_at = now() WHERE channel_id = $1 AND user_id = $2 RETURNING user_id', [privateId, member.id])).toHaveLength(1);
    // Members can leave; only owners remove others.
    expect(await as(member.id, ws.workspaceId, 'DELETE FROM chat_member WHERE channel_id = $1 AND user_id = $2 RETURNING user_id', [privateId, ws.owner.id])).toEqual([]);
  });

  it('keeps reactions to people who can read the channel, and to your own', async () => {
    const [message] = await post(ws.owner.id, privateId, 'react to me');
    const react = (userId: string) =>
      as(userId, ws.workspaceId, 'INSERT INTO chat_reaction (message_id, user_id, emoji, workspace_id, channel_id) VALUES ($1, $2, $3, $4, $5)', [message!.id, userId, '👍', ws.workspaceId, privateId]);
    await react(member.id);
    // Refused either way: the outsider can't even see the message (trigger) or post there (RLS).
    await expect(react(outsider.id)).rejects.toThrow(/row-level security|live message in its channel/);
    // Reacting as someone else, or putting a reaction in another channel, is refused.
    await expect(as(member.id, ws.workspaceId, 'INSERT INTO chat_reaction (message_id, user_id, emoji, workspace_id, channel_id) VALUES ($1, $2, $3, $4, $5)', [message!.id, ws.owner.id, '🎉', ws.workspaceId, privateId])).rejects.toThrow(/row-level security/);
    await expect(as(member.id, ws.workspaceId, 'INSERT INTO chat_reaction (message_id, user_id, emoji, workspace_id, channel_id) VALUES ($1, $2, $3, $4, $5)', [message!.id, member.id, '🎉', ws.workspaceId, publicId])).rejects.toThrow(/live message in its channel|row-level security/);
    expect(await as(outsider.id, ws.workspaceId, 'SELECT emoji FROM chat_reaction')).toEqual([]);
    expect(await as(ws.owner.id, ws.workspaceId, 'DELETE FROM chat_reaction WHERE user_id = $1 RETURNING emoji', [member.id])).toEqual([]);
    expect(await as(member.id, ws.workspaceId, 'DELETE FROM chat_reaction WHERE user_id = $1 RETURNING emoji', [member.id])).toHaveLength(1);
  });

  it('gives the platform scope every chat row', async () => {
    const rows = await withScope(db, { platform: true }, async (client) => (await client.query('SELECT id FROM chat_channel WHERE workspace_id = $1', [ws.workspaceId])).rows);
    expect(rows).toHaveLength(4);
  });
});
