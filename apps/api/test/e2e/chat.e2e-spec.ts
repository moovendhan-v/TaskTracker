import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { subscribeToWorkspace, type LiveSubscription } from './support/realtime.js';

const CHANNEL = 'id kind name topic archived myRole memberCount unreadCount dmMembers { id name }';
const MESSAGE = 'id channelId parentId authorId authorName kind body taskId replyCount deleted editedAt';
const CHANNELS = `query($w: ID!) { chatChannels(workspaceId: $w) { ${CHANNEL} } }`;
const BROWSE = `query($w: ID!, $s: String) { browseChatChannels(workspaceId: $w, search: $s) { ${CHANNEL} } }`;
const CREATE = `mutation($w: ID!, $input: CreateChatChannelInput!) { createChatChannel(workspaceId: $w, input: $input) { ${CHANNEL} } }`;
const DM = `mutation($w: ID!, $u: [ID!]!) { openDirectMessage(workspaceId: $w, userIds: $u) { ${CHANNEL} } }`;
const SEND = `mutation($w: ID!, $input: SendChatMessageInput!) { sendChatMessage(workspaceId: $w, input: $input) { ${MESSAGE} } }`;
const MESSAGES = `query($w: ID!, $c: ID!, $before: String, $first: Int) { chatMessages(workspaceId: $w, channelId: $c, before: $before, first: $first) { items { ${MESSAGE} } cursor } }`;
const THREAD = `query($w: ID!, $m: ID!) { chatThread(workspaceId: $w, messageId: $m) { items { ${MESSAGE} } cursor } }`;
const MESSAGE_ONE = `query($w: ID!, $m: ID!) { chatMessage(workspaceId: $w, messageId: $m) { ${MESSAGE} } }`;
const EDIT = `mutation($w: ID!, $m: ID!, $b: String!) { editChatMessage(workspaceId: $w, messageId: $m, body: $b) { ${MESSAGE} } }`;
const DELETE = 'mutation($w: ID!, $m: ID!) { deleteChatMessage(workspaceId: $w, messageId: $m) }';
const JOIN = `mutation($w: ID!, $c: ID!) { joinChatChannel(workspaceId: $w, channelId: $c) { ${CHANNEL} } }`;
const LEAVE = 'mutation($w: ID!, $c: ID!) { leaveChatChannel(workspaceId: $w, channelId: $c) }';
const ADD = 'mutation($w: ID!, $c: ID!, $u: [ID!]!) { addChatChannelMembers(workspaceId: $w, channelId: $c, userIds: $u) { userId role } }';
const REMOVE = 'mutation($w: ID!, $c: ID!, $u: ID!) { removeChatChannelMember(workspaceId: $w, channelId: $c, userId: $u) }';
const ROLE = 'mutation($w: ID!, $c: ID!, $u: ID!, $r: String!) { setChatChannelMemberRole(workspaceId: $w, channelId: $c, userId: $u, role: $r) { userId role } }';
const MEMBERS = 'query($w: ID!, $c: ID!) { chatChannelMembers(workspaceId: $w, channelId: $c) { userId role } }';
const ARCHIVE = `mutation($w: ID!, $c: ID!, $a: Boolean) { archiveChatChannel(workspaceId: $w, channelId: $c, archived: $a) { ${CHANNEL} } }`;
const UPDATE = `mutation($w: ID!, $c: ID!, $input: UpdateChatChannelInput!) { updateChatChannel(workspaceId: $w, channelId: $c, input: $input) { ${CHANNEL} } }`;
const READ = 'mutation($w: ID!, $c: ID!, $at: String!) { markChatChannelRead(workspaceId: $w, channelId: $c, at: $at) }';
const TASK_FROM = `mutation($w: ID!, $input: CreateTaskFromMessageInput!) { createTaskFromChatMessage(workspaceId: $w, input: $input) { ${MESSAGE} } }`;

interface Channel {
  id: string;
  kind: string;
  name: string | null;
  myRole: string | null;
  memberCount: number;
  unreadCount: number;
  archived: boolean;
  dmMembers: { id: string; name: string }[];
}
interface Message {
  id: string;
  parentId: string | null;
  authorId: string | null;
  kind: string;
  body: string;
  taskId: string | null;
  replyCount: number;
  deleted: boolean;
  editedAt: string | null;
}

describe('chat', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let teammate: TestUser;
  let admin: TestUser;
  let guest: TestUser;
  let w: string;
  const open: LiveSubscription[] = [];

  const create = async (user: TestUser, input: Record<string, unknown>) => (await user.data<{ createChatChannel: Channel }>(CREATE, { w, input })).createChatChannel;
  const send = async (user: TestUser, channelId: string, body: string, parentId?: string) =>
    (await user.data<{ sendChatMessage: Message }>(SEND, { w, input: { channelId, body, parentId } })).sendChatMessage;
  const names = async (user: TestUser) => (await user.data<{ chatChannels: Channel[] }>(CHANNELS, { w })).chatChannels.map((c) => c.name ?? `dm:${c.dmMembers.map((p) => p.name).join('+')}`);

  beforeAll(async () => {
    ws = await createWorkspace('Chat owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Chat member');
    teammate = await TestUser.signUp('Chat teammate');
    admin = await TestUser.signUp('Chat admin');
    guest = await TestUser.signUp('Chat guest');
    await addMember(ws, member, 'Member');
    await addMember(ws, teammate, 'Member');
    await addMember(ws, admin, 'Admin');
    await addMember(ws, guest, 'Guest');
  });

  afterAll(async () => {
    await Promise.all(open.map((live) => live.close()));
  });

  it('creates public and private channels, and keeps private ones to their members', async () => {
    const general = await create(ws.owner, { name: 'general', topic: 'Everything' });
    expect(general).toMatchObject({ kind: 'public', myRole: 'owner', memberCount: 1 });
    const leads = await create(ws.owner, { name: 'leads', kind: 'private', memberIds: [member.id] });
    expect(leads.memberCount).toBe(2);

    expect(await names(member)).toEqual(['leads']);
    expect(await names(teammate)).toEqual([]);
    // The teammate can find and join the public channel, but the private one doesn't exist for them.
    expect((await teammate.data<{ browseChatChannels: Channel[] }>(BROWSE, { w, s: 'gen' })).browseChatChannels.map((c) => c.name)).toEqual(['general']);
    expect((await teammate.data<{ browseChatChannels: Channel[] }>(BROWSE, { w, s: 'lead' })).browseChatChannels).toEqual([]);
    expect((await teammate.error(JOIN, { w, c: leads.id })).code).toBe('NOT_FOUND');
    expect((await teammate.error(MESSAGES, { w, c: leads.id })).code).toBe('NOT_FOUND');
    expect((await teammate.error(MEMBERS, { w, c: leads.id })).code).toBe('NOT_FOUND');
    expect((await teammate.data<{ joinChatChannel: Channel }>(JOIN, { w, c: general.id })).joinChatChannel.myRole).toBe('member');

    // Names are validated and unique.
    expect((await ws.owner.error(CREATE, { w, input: { name: 'Has Space' } })).code).toBe('BAD_USER_INPUT');
    expect((await ws.owner.error(CREATE, { w, input: { name: 'general' } })).code).toBe('CONFLICT');
    // Only workspace members can be added.
    const outsider = await TestUser.signUp('Chat outsider');
    expect((await ws.owner.error(CREATE, { w, input: { name: 'x', memberIds: [outsider.id] } })).message).toMatch(/member of this workspace/);
  });

  it('keeps chat away from guests and outsiders', async () => {
    expect((await guest.error(CHANNELS, { w })).code).toBe('FORBIDDEN');
    const outsider = await TestUser.signUp('Chat stranger');
    expect((await outsider.error(CHANNELS, { w })).code).toMatch(/FORBIDDEN|NOT_FOUND/);
  });

  it('posts, threads, edits and deletes messages, with paging', async () => {
    const channel = await create(ws.owner, { name: 'platform', memberIds: [member.id] });
    const root = await send(ws.owner, channel.id, '  Shipping the **SSO** fix today  ');
    expect(root.body).toBe('Shipping the **SSO** fix today');
    const reply = await send(member, channel.id, 'Looks good', root.id);
    // Replying to a reply lands in the same thread.
    const nested = await send(ws.owner, channel.id, 'Thanks', reply.id);
    expect(nested.parentId).toBe(root.id);

    const thread = (await member.data<{ chatThread: { items: Message[] } }>(THREAD, { w, m: root.id })).chatThread.items;
    expect(thread.map((m) => m.body)).toEqual(['Looks good', 'Thanks']);
    expect((await member.data<{ chatMessage: Message }>(MESSAGE_ONE, { w, m: root.id })).chatMessage.replyCount).toBe(2);

    // Only the author edits or deletes.
    expect((await member.error(EDIT, { w, m: root.id, b: 'hijack' })).code).toBe('FORBIDDEN');
    expect((await member.error(DELETE, { w, m: root.id })).code).toBe('FORBIDDEN');
    const edited = (await ws.owner.data<{ editChatMessage: Message }>(EDIT, { w, m: root.id, b: 'Shipping the fix tomorrow' })).editChatMessage;
    expect(edited.editedAt).not.toBeNull();
    expect((await member.data<{ deleteChatMessage: boolean }>(DELETE, { w, m: reply.id })).deleteChatMessage).toBe(true);
    const gone = (await ws.owner.data<{ chatMessage: Message }>(MESSAGE_ONE, { w, m: reply.id })).chatMessage;
    expect(gone).toMatchObject({ deleted: true, body: '' });

    // Bodies are validated.
    expect((await ws.owner.error(SEND, { w, input: { channelId: channel.id, body: '   ' } })).code).toBe('BAD_USER_INPUT');
    expect((await ws.owner.error(SEND, { w, input: { channelId: channel.id, body: 'x'.repeat(4001) } })).code).toBe('BAD_USER_INPUT');

    // Keyset paging, newest first.
    for (let i = 1; i <= 4; i++) await send(ws.owner, channel.id, `m${i}`);
    const first = (await member.data<{ chatMessages: { items: Message[]; cursor: string } }>(MESSAGES, { w, c: channel.id, first: 3 })).chatMessages;
    expect(first.items.map((m) => m.body)).toEqual(['m4', 'm3', 'm2']);
    const second = (await member.data<{ chatMessages: { items: Message[]; cursor: string | null } }>(MESSAGES, { w, c: channel.id, first: 3, before: first.cursor })).chatMessages;
    expect(second.items.map((m) => m.body)).toEqual(['m1', 'Shipping the fix tomorrow']);
    expect(second.cursor).toBeNull();
    expect((await member.error(MESSAGES, { w, c: channel.id, before: 'bogus' })).code).toBe('BAD_USER_INPUT');

    // Unread counts come from the read marker, and never count your own messages.
    const unread = async () => (await member.data<{ chatChannels: Channel[] }>(CHANNELS, { w })).chatChannels.find((c) => c.id === channel.id)!.unreadCount;
    expect(await unread()).toBe(5);
    await member.data(READ, { w, c: channel.id, at: new Date(Date.now() + 60_000).toISOString() });
    expect(await unread()).toBe(0);
    await member.data(READ, { w, c: channel.id, at: '2020-01-01T00:00:00Z' }); // never moves back
    expect(await unread()).toBe(0);
  });

  it('posting in a public channel joins it; nobody posts into a private one they are not in', async () => {
    const open = await create(ws.owner, { name: 'random' });
    const message = await send(teammate, open.id, 'hi');
    expect(message.authorId).toBe(teammate.id);
    expect((await teammate.data<{ chatChannels: Channel[] }>(CHANNELS, { w })).chatChannels.some((c) => c.id === open.id)).toBe(true);
    const secret = await create(ws.owner, { name: 'secret', kind: 'private' });
    expect((await teammate.error(SEND, { w, input: { channelId: secret.id, body: 'hi' } })).code).toBe('NOT_FOUND');
    // A message id from a channel you can't read isn't found either.
    const hidden = await send(ws.owner, secret.id, 'hidden');
    expect((await teammate.error(MESSAGE_ONE, { w, m: hidden.id })).code).toBe('NOT_FOUND');
    expect((await teammate.error(SEND, { w, input: { channelId: open.id, body: 'reply', parentId: hidden.id } })).code).toBe('NOT_FOUND');
  });

  it('finds or starts direct messages between workspace members only', async () => {
    const dm = (await member.data<{ openDirectMessage: Channel }>(DM, { w, u: [teammate.id] })).openDirectMessage;
    expect(dm).toMatchObject({ kind: 'dm', name: null, memberCount: 2 });
    expect(dm.dmMembers.map((p) => p.id)).toEqual([teammate.id]);
    // Same people, same DM, whoever opens it.
    expect((await teammate.data<{ openDirectMessage: Channel }>(DM, { w, u: [member.id] })).openDirectMessage.id).toBe(dm.id);
    expect((await member.error(DM, { w, u: [] })).code).toBe('BAD_USER_INPUT');
    expect((await member.error(DM, { w, u: Array.from({ length: 8 }, (_, i) => `user-${i}`) })).code).toBe('BAD_USER_INPUT');
    const outsider = await TestUser.signUp('Chat DM outsider');
    expect((await member.error(DM, { w, u: [outsider.id] })).message).toMatch(/member of this workspace/);
    // Others can't read it, and nobody can be added or leave.
    await send(member, dm.id, 'just us');
    expect((await ws.owner.error(MESSAGES, { w, c: dm.id })).code).toBe('NOT_FOUND');
    expect((await member.error(ADD, { w, c: dm.id, u: [ws.owner.id] })).code).toMatch(/FORBIDDEN|BAD_USER_INPUT/);
    expect((await member.error(LEAVE, { w, c: dm.id })).code).toBe('BAD_USER_INPUT');
  });

  it('lets only owners manage members, and admins moderate public channels with an audit entry', async () => {
    const team = await create(ws.owner, { name: 'team', kind: 'private', memberIds: [member.id] });
    expect((await member.error(ADD, { w, c: team.id, u: [teammate.id] })).code).toBe('FORBIDDEN');
    expect((await member.error(REMOVE, { w, c: team.id, u: ws.owner.id })).code).toBe('FORBIDDEN');
    expect((await member.error(ROLE, { w, c: team.id, u: member.id, r: 'owner' })).code).toBe('FORBIDDEN');
    expect((await ws.owner.data<{ addChatChannelMembers: unknown[] }>(ADD, { w, c: team.id, u: [teammate.id] })).addChatChannelMembers).toHaveLength(3);
    // The last owner can't walk away from a channel with people in it.
    expect((await ws.owner.error(LEAVE, { w, c: team.id })).message).toMatch(/someone else an owner/);
    await ws.owner.data(ROLE, { w, c: team.id, u: member.id, r: 'owner' });
    expect((await ws.owner.data<{ leaveChatChannel: boolean }>(LEAVE, { w, c: team.id })).leaveChatChannel).toBe(true);
    expect((await member.data<{ removeChatChannelMember: boolean }>(REMOVE, { w, c: team.id, u: teammate.id })).removeChatChannelMember).toBe(true);
    expect(await names(teammate)).not.toContain('team');

    // An admin (chat.manage) can archive someone else's public channel, not a private one they aren't in.
    const ops = await create(member, { name: 'ops' });
    expect((await teammate.error(ARCHIVE, { w, c: ops.id })).code).toBe('FORBIDDEN');
    expect((await admin.error(ARCHIVE, { w, c: team.id })).code).toBe('NOT_FOUND');
    expect((await admin.data<{ archiveChatChannel: Channel }>(ARCHIVE, { w, c: ops.id })).archiveChatChannel.archived).toBe(true);
    expect((await member.error(SEND, { w, input: { channelId: ops.id, body: 'still here?' } })).message).toMatch(/archived/);
    expect((await admin.data<{ updateChatChannel: Channel }>(UPDATE, { w, c: ops.id, input: { name: 'ops-old' } })).updateChatChannel.name).toBe('ops-old');

    const db = runtimeDatabase();
    try {
      const rows = await withScope(db, { workspaceId: w }, async (client) =>
        (await client.query<{ action: string; actor_id: string }>("SELECT action, actor_id FROM audit_log WHERE target_id = $1 AND action LIKE 'chat.%' ORDER BY created_at", [ops.id])).rows,
      );
      expect(rows).toEqual([
        { action: 'chat.channel.archive', actor_id: admin.id },
        { action: 'chat.channel.update', actor_id: admin.id },
      ]);
    } finally {
      await db.end();
    }
  });

  it('turns a message into a task with the caller’s own task rights', async () => {
    const channel = await create(ws.owner, { name: 'bugs', memberIds: [member.id] });
    const message = await send(member, channel.id, 'Fix login crash on SSO redirect\nSteps: …');
    const line = (await member.data<{ createTaskFromChatMessage: Message }>(TASK_FROM, { w, input: { messageId: message.id, listId: ws.listId } })).createTaskFromChatMessage;
    expect(line).toMatchObject({ kind: 'system', parentId: message.id });
    expect(line.body).toMatch(/^created #\d+$/);
    const { task } = await member.data<{ task: { title: string; description: string } }>('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { title description } }', { w, t: line.taskId });
    expect(task.title).toBe('Fix login crash on SSO redirect');
    expect(task.description).toContain('Steps: …');
    expect(task.description).toContain('— Chat member in #bugs');
    // System lines can't be edited, and a list in another workspace is not found.
    expect((await member.error(EDIT, { w, m: line.id, b: 'x' })).code).toBe('BAD_USER_INPUT');
    const other = await createWorkspace('Chat other');
    expect((await member.error(TASK_FROM, { w, input: { messageId: message.id, listId: other.listId } })).code).toMatch(/NOT_FOUND|FORBIDDEN/);
  });

  it('sends private channel and DM events only to their members', async () => {
    const ownerLive = await subscribeToWorkspace(ws.owner, w);
    const teammateLive = await subscribeToWorkspace(teammate, w);
    open.push(ownerLive, teammateLive);

    const secret = await create(member, { name: 'quiet', kind: 'private', memberIds: [ws.owner.id] });
    const hidden = await send(member, secret.id, 'psst');
    const lobby = await create(member, { name: 'lobby' });
    const shout = await send(ws.owner, lobby.id, 'hello all');

    await ownerLive.waitFor((event) => event.entityId === hidden.id);
    await teammateLive.waitFor((event) => event.entityId === shout.id);
    // Public traffic reached the teammate; nothing about the private channel did.
    expect(teammateLive.events.some((event) => event.entityId === hidden.id || event.entityId === secret.id)).toBe(false);
  });

  it('notifies mentioned people who can read the channel, and nobody else', async () => {
    const NOTIFICATIONS = 'query($w: ID!) { notifications(workspaceId: $w, unreadOnly: true) { items { kind subject excerpt entityId actorName } } }';
    const mentionsOf = async (user: TestUser) =>
      (await user.data<{ notifications: { items: { kind: string; subject: string; excerpt: string; entityId: string }[] } }>(NOTIFICATIONS, { w })).notifications.items.filter((n) => n.kind === 'chat_mention');
    const room = await create(teammate, { name: 'mentions', kind: 'private', memberIds: [member.id] });
    const message = await send(teammate, room.id, `@{${member.id}} and @{${admin.id}} and @{${guest.id}} and me @{${teammate.id}}: **ship it**`);
    // Only the member is in the private channel; the admin isn't, and nobody notifies themselves.
    const [mention] = await mentionsOf(member);
    expect(mention).toMatchObject({ subject: '#mentions', entityId: message.id });
    expect(mention!.excerpt).toBe('@Chat member and @Chat admin and @Chat guest and me @Chat teammate: ship it');
    expect(await mentionsOf(admin)).toEqual([]);
    expect(await mentionsOf(teammate)).toEqual([]);

    // In a public channel anyone with chat access can be mentioned, but not guests (no chat.use).
    const lobby = await create(teammate, { name: 'mentions-public' });
    await send(teammate, lobby.id, `@{${admin.id}} @{${guest.id}} look`);
    expect(await mentionsOf(admin)).toHaveLength(1);
    expect((await guest.data<{ notifications: { items: { kind: string }[] } }>(NOTIFICATIONS, { w })).notifications.items.filter((n) => n.kind === 'chat_mention')).toEqual([]);
  });

  it('rate limits sending messages', async () => {
    const spam = await create(admin, { name: 'spam' });
    const results = [];
    for (let i = 0; i < 32; i++) results.push(await admin.gql(SEND, { w, input: { channelId: spam.id, body: `m${i}` } }));
    expect(results.some((result) => result.errors?.[0]?.extensions?.code === 'TOO_MANY_REQUESTS')).toBe(true);
  });
});
