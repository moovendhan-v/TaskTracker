import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE = 'mutation($w: ID!, $input: CreateChatChannelInput!) { createChatChannel(workspaceId: $w, input: $input) { id } }';
const SEND = 'mutation($w: ID!, $input: SendChatMessageInput!) { sendChatMessage(workspaceId: $w, input: $input) { id } }';
const DELETE = 'mutation($w: ID!, $m: ID!) { deleteChatMessage(workspaceId: $w, messageId: $m) }';
const DM = 'mutation($w: ID!, $u: [ID!]!) { openDirectMessage(workspaceId: $w, userIds: $u) { id } }';
const EXPORT = 'mutation($w: ID!, $c: ID!, $f: String!) { exportChatChannel(workspaceId: $w, channelId: $c, format: $f) { fileName contentType content messages truncated } }';
const AUDIT = 'query($w: ID!) { workspaceAuditLog(workspaceId: $w) { items { action } } }';

interface Exported {
  fileName: string;
  contentType: string;
  content: string;
  messages: number;
  truncated: boolean;
}

/** D1: downloading a channel's history. */
describe('chat export', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let outsider: TestUser;
  let channelId: string;
  const send = async (user: TestUser, body: string, parentId?: string) => (await user.data<{ sendChatMessage: { id: string } }>(SEND, { w, input: { channelId, body, parentId } })).sendChatMessage.id;
  const exportAs = async (user: TestUser, format: string, channel = channelId) => (await user.data<{ exportChatChannel: Exported }>(EXPORT, { w, c: channel, f: format })).exportChatChannel;

  beforeAll(async () => {
    ws = await createWorkspace('Export owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Export member');
    outsider = await TestUser.signUp('Export outsider');
    await addMember(ws, member, 'Member');
    await addMember(ws, outsider, 'Member');
    channelId = (await ws.owner.data<{ createChatChannel: { id: string } }>(CREATE, { w, input: { name: 'launch-plans', kind: 'private', memberIds: [member.id] } })).createChatChannel.id;
    const root = await send(ws.owner, 'Ship on Friday?\n# careful');
    await send(member, 'Yes, after the review', root);
    const gone = await send(member, 'Wrong channel, sorry');
    await ws.owner.data(DELETE, { w, m: gone }).catch(() => undefined);
    await member.data(DELETE, { w, m: gone });
  });

  it('exports what a member can read as Markdown, oldest first, with replies and without deleted messages', async () => {
    const file = await exportAs(member, 'markdown');
    expect(file.fileName).toMatch(/^launch-plans-\d{4}-\d{2}-\d{2}\.md$/);
    expect(file.contentType).toBe('text/markdown');
    expect(file).toMatchObject({ messages: 2, truncated: false });
    expect(file.content).toContain('# #launch-plans');
    expect(file.content).toContain('> Ship on Friday?\n> # careful');
    expect(file.content).toMatch(/ {4}\*\*Export member\*\* · .+\n {4}> Yes, after the review/);
    expect(file.content).not.toContain('Wrong channel');
  });

  it('exports JSON for processing', async () => {
    const parsed = JSON.parse((await exportAs(ws.owner, 'json')).content) as { channel: string; messages: { author: string; body: string; replies: { author: string }[] }[] };
    expect(parsed.channel).toBe('#launch-plans');
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toMatchObject({ author: 'Export owner', body: 'Ship on Friday?\n# careful', replies: [{ author: 'Export member' }] });
  });

  it('is only for people who can read the channel, and is audited', async () => {
    expect((await outsider.error(EXPORT, { w, c: channelId, f: 'markdown' })).code).toBe('NOT_FOUND');
    expect((await member.error(EXPORT, { w, c: channelId, f: 'pdf' })).message).toMatch(/markdown or json/);
    const audit = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string }[] } }>(AUDIT, { w })).workspaceAuditLog.items.filter((entry) => entry.action === 'chat.export');
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });

  it('names a direct message plainly', async () => {
    const dm = (await member.data<{ openDirectMessage: { id: string } }>(DM, { w, u: [outsider.id] })).openDirectMessage.id;
    await member.data(SEND, { w, input: { channelId: dm, body: 'hi' } });
    expect((await exportAs(outsider, 'markdown', dm)).fileName).toMatch(/^direct-message-/);
  });
});
