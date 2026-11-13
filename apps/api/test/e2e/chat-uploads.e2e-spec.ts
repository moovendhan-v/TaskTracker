import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const REQUEST = 'mutation($w: ID!, $input: RequestChatUploadInput!) { requestChatUpload(workspaceId: $w, input: $input) { attachmentId uploadUrl maxBytes } }';
const COMPLETE = 'mutation($w: ID!, $a: ID!) { completeChatUpload(workspaceId: $w, attachmentId: $a) { error attachment { id fileName contentType size isImage url thumbnailUrl } } }';
const DISCARD = 'mutation($w: ID!, $a: ID!) { discardChatUpload(workspaceId: $w, attachmentId: $a) }';
const SEND = 'mutation($w: ID!, $input: SendChatMessageInput!) { sendChatMessage(workspaceId: $w, input: $input) { id body attachments { id fileName url isImage } } }';
const MESSAGE = 'query($w: ID!, $m: ID!) { chatMessage(workspaceId: $w, messageId: $m) { attachments { url } } }';
const CREATE = 'mutation($w: ID!, $input: CreateChatChannelInput!) { createChatChannel(workspaceId: $w, input: $input) { id } }';
const DELETE = 'mutation($w: ID!, $m: ID!) { deleteChatMessage(workspaceId: $w, messageId: $m) }';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);

interface Ticket {
  attachmentId: string;
  uploadUrl: string;
}

describe('chat file uploads', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let outsider: TestUser;
  let channelId: string;

  const request = async (user: TestUser, fileName: string, size: number, channel = channelId) =>
    (await user.data<{ requestChatUpload: Ticket }>(REQUEST, { w, input: { channelId: channel, fileName, size } })).requestChatUpload;
  const put = (user: TestUser, ticket: Ticket, body: Buffer) =>
    fetch(user.baseUrl + ticket.uploadUrl, { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream' } });
  const download = (user: TestUser, url: string) => fetch(user.baseUrl + url);
  const upload = async (user: TestUser, fileName: string, body: Buffer) => {
    const ticket = await request(user, fileName, body.length);
    expect((await put(user, ticket, body)).status).toBe(204);
    return ticket;
  };

  beforeAll(async () => {
    ws = await createWorkspace('Uploads owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Uploads member');
    outsider = await TestUser.signUp('Uploads teammate');
    await addMember(ws, member, 'Member');
    await addMember(ws, outsider, 'Member');
    channelId = (await ws.owner.data<{ createChatChannel: { id: string } }>(CREATE, { w, input: { name: 'files', kind: 'private', memberIds: [member.id] } })).createChatChannel.id;
  });

  it('uploads, checks, attaches and serves an image only to people who can read the channel', async () => {
    const ticket = await upload(ws.owner, 'screen shot.png', PNG);
    // The link works once: the checked file can't be swapped afterwards.
    expect((await put(ws.owner, ticket, Buffer.from('<html>swap</html>'))).status).toBe(409);
    const file = (await ws.owner.data<{ completeChatUpload: { attachment: { contentType: string; isImage: boolean; size: number } } }>(COMPLETE, { w, a: ticket.attachmentId })).completeChatUpload.attachment;
    expect(file).toMatchObject({ contentType: 'image/png', isImage: true, size: PNG.length });

    // Files only: the text may be empty.
    const message = (await ws.owner.data<{ sendChatMessage: { id: string; body: string; attachments: { fileName: string; url: string }[] } }>(SEND, {
      w,
      input: { channelId, body: '', attachmentIds: [ticket.attachmentId] },
    })).sendChatMessage;
    expect(message.body).toBe('');
    expect(message.attachments.map((a) => a.fileName)).toEqual(['screen shot.png']);

    const { url } = (await member.data<{ chatMessage: { attachments: { url: string }[] } }>(MESSAGE, { w, m: message.id })).chatMessage.attachments[0]!;
    const response = await download(member, url);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-disposition')).toContain('inline');
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);

    // Not in the channel: the message, and so its link, doesn't exist for them.
    expect((await outsider.error(MESSAGE, { w, m: message.id })).code).toBe('NOT_FOUND');
    // A link can't be altered or reused for another file.
    const [payload, mac] = url.split('/').pop()!.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), key: 'w/other/chat/x' })).toString('base64url');
    expect((await download(outsider, `/api/storage/files/${forged}.${mac}`)).status).toBe(403);

    // Deleting the message removes the file.
    await ws.owner.data(DELETE, { w, m: message.id });
    expect((await download(member, url)).status).toBe(404);
  });

  it('refuses disguised, oversized and unexpected files', async () => {
    // HTML named .png: rejected once its first bytes are read, and deleted.
    const disguised = await upload(member, 'cat.png', Buffer.from('<html><script>alert(1)</script></html>'));
    const refused = (await member.data<{ completeChatUpload: { attachment: null; error: string } }>(COMPLETE, { w, a: disguised.attachmentId })).completeChatUpload;
    expect(refused).toEqual({ attachment: null, error: "This file's contents don't match an allowed type" });
    expect((await member.error(COMPLETE, { w, a: disguised.attachmentId })).code).toBe('NOT_FOUND');
    // SVG and executables never get an upload link.
    expect((await member.error(REQUEST, { w, input: { channelId, fileName: 'logo.svg', size: 10 } })).code).toBe('BAD_USER_INPUT');
    expect((await member.error(REQUEST, { w, input: { channelId, fileName: 'setup.exe', size: 10 } })).code).toBe('BAD_USER_INPUT');
    expect((await member.error(REQUEST, { w, input: { channelId, fileName: 'big.pdf', size: 11 * 1024 * 1024 } })).code).toBe('BAD_USER_INPUT');
    // More bytes than declared: refused at the door.
    const small = await request(member, 'notes.txt', 5);
    expect((await put(member, small, Buffer.from('much more than five bytes'))).status).toBe(413);
    // A link only works for the upload it was made for, and is useless when altered.
    const ticket = await request(member, 'a.png', PNG.length);
    expect((await fetch(member.baseUrl + ticket.uploadUrl + 'x', { method: 'PUT', body: PNG })).status).toBe(403);
    await member.data(DISCARD, { w, a: ticket.attachmentId });
    expect((await member.error(COMPLETE, { w, a: ticket.attachmentId })).code).toBe('NOT_FOUND');
  });

  it("keeps files to their uploader and channel until they're sent", async () => {
    const mine = await upload(member, 'plan.txt', Buffer.from('the plan'));
    await member.data(COMPLETE, { w, a: mine.attachmentId });
    // Nobody else can check, discard or send someone else's file.
    expect((await ws.owner.error(COMPLETE, { w, a: mine.attachmentId })).code).toBe('NOT_FOUND');
    expect((await ws.owner.error(DISCARD, { w, a: mine.attachmentId })).code).toBe('NOT_FOUND');
    expect((await ws.owner.error(SEND, { w, input: { channelId, body: 'stolen', attachmentIds: [mine.attachmentId] } })).message).toMatch(/aren't ready/);
    // Or move it to another channel.
    const other = (await member.data<{ createChatChannel: { id: string } }>(CREATE, { w, input: { name: 'elsewhere' } })).createChatChannel.id;
    expect((await member.error(SEND, { w, input: { channelId: other, body: 'moved', attachmentIds: [mine.attachmentId] } })).message).toMatch(/aren't ready/);
    // You can't upload into a private channel you're not in, and empty messages need a file.
    expect((await outsider.error(REQUEST, { w, input: { channelId, fileName: 'x.png', size: 10 } })).code).toBe('NOT_FOUND');
    expect((await member.error(SEND, { w, input: { channelId, body: '  ' } })).code).toBe('BAD_USER_INPUT');
    const sent = (await member.data<{ sendChatMessage: { attachments: { fileName: string; isImage: boolean }[] } }>(SEND, { w, input: { channelId, body: 'here it is', attachmentIds: [mine.attachmentId] } })).sendChatMessage;
    expect(sent.attachments).toEqual([{ fileName: 'plan.txt', isImage: false, id: mine.attachmentId, url: expect.stringMatching(/^\/api\/storage\/files\//) }]);
  });

  it('makes a small preview of a real image, served like the file', async () => {
    const photo = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#cc6633' } }).jpeg().toBuffer();
    const ticket = await upload(ws.owner, 'holiday.jpg', photo);
    const { attachment } = (await ws.owner.data<{ completeChatUpload: { attachment: { thumbnailUrl: string | null; url: string } } }>(COMPLETE, { w, a: ticket.attachmentId })).completeChatUpload;
    expect(attachment.thumbnailUrl).toMatch(/^\/api\/storage\/files\//);
    const preview = await download(ws.owner, attachment.thumbnailUrl!);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-type')).toBe('image/webp');
    expect(preview.headers.get('x-content-type-options')).toBe('nosniff');
    const meta = await sharp(Buffer.from(await preview.arrayBuffer())).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 480, 360]);
    // Files that aren't images get none.
    const notes = await upload(ws.owner, 'notes.txt', Buffer.from('plain notes'));
    expect((await ws.owner.data<{ completeChatUpload: { attachment: { thumbnailUrl: string | null } } }>(COMPLETE, { w, a: notes.attachmentId })).completeChatUpload.attachment.thumbnailUrl).toBeNull();
    await ws.owner.data(DISCARD, { w, a: ticket.attachmentId });
    await ws.owner.data(DISCARD, { w, a: notes.attachmentId });
  });

  it('refuses a file the virus scan flags, and deletes it', async () => {
    // The EICAR antivirus test file: harmless, and flagged by every scanner (the tests use the mock).
    const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    const ticket = await upload(member, 'invoice.txt', eicar);
    const { completeChatUpload } = await member.data<{ completeChatUpload: { error: string | null; attachment: unknown } }>(COMPLETE, { w, a: ticket.attachmentId });
    expect(completeChatUpload).toEqual({ attachment: null, error: 'This file looks harmful (the virus scan flagged it), so it wasn’t added' });
    // Gone: it can't be completed again or sent.
    expect((await member.error(COMPLETE, { w, a: ticket.attachmentId })).code).toBe('NOT_FOUND');
  });
});
