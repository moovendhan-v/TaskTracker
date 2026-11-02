import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const REQUEST = 'mutation($w: ID!, $input: RequestTaskUploadInput!) { requestTaskUpload(workspaceId: $w, input: $input) { attachmentId uploadUrl } }';
const COMPLETE = 'mutation($w: ID!, $a: ID!) { completeTaskUpload(workspaceId: $w, attachmentId: $a) { error attachment { id fileName contentType isImage url uploaderName } } }';
const LIST = 'query($w: ID!, $t: ID!) { taskAttachments(workspaceId: $w, taskId: $t) { id fileName url } }';
const DELETE = 'mutation($w: ID!, $a: ID!) { deleteTaskAttachment(workspaceId: $w, attachmentId: $a) }';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

interface Ticket {
  attachmentId: string;
  uploadUrl: string;
}

describe('task attachments', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let taskId: string;
  let member: TestUser;
  let guest: TestUser;

  const upload = async (user: TestUser, fileName: string, body: Buffer) => {
    const ticket = (await user.data<{ requestTaskUpload: Ticket }>(REQUEST, { w, input: { taskId, fileName, size: body.length } })).requestTaskUpload;
    expect((await fetch(user.baseUrl + ticket.uploadUrl, { method: 'PUT', body })).status).toBe(204);
    return ticket;
  };
  const complete = async (user: TestUser, ticket: Ticket) =>
    (await user.data<{ completeTaskUpload: { error: string | null; attachment: { id: string; fileName: string; isImage: boolean; url: string; uploaderName: string } | null } }>(COMPLETE, { w, a: ticket.attachmentId }))
      .completeTaskUpload;
  const list = async (user: TestUser) => (await user.data<{ taskAttachments: { id: string; fileName: string; url: string }[] }>(LIST, { w, t: taskId })).taskAttachments;

  beforeAll(async () => {
    ws = await createWorkspace('Task files');
    w = ws.workspaceId;
    member = await TestUser.signUp('Task files member');
    guest = await TestUser.signUp('Task files guest');
    await addMember(ws, member, 'Member');
    await addMember(ws, guest, 'Guest');
    taskId = (await ws.owner.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Spec" }) { id } }', { w, l: ws.listId })).createTask.id;
  });

  it('adds checked files that everyone who can see the task can open', async () => {
    const ticket = await upload(member, 'mockup.png', PNG);
    // While it's being uploaded, nobody else sees it.
    expect(await list(ws.owner)).toEqual([]);
    const result = await complete(member, ticket);
    expect(result.attachment).toMatchObject({ fileName: 'mockup.png', contentType: 'image/png', isImage: true, uploaderName: 'Task files member' });

    const [file] = await list(guest);
    expect(file!.fileName).toBe('mockup.png');
    const download = await fetch(guest.baseUrl + file!.url);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('image/png');

    // Guests can look but not add.
    expect((await guest.error(REQUEST, { w, input: { taskId, fileName: 'x.png', size: 10 } })).code).toBe('FORBIDDEN');
    // Another workspace can't see the task, or its files.
    const other = await createWorkspace('Task files other');
    expect((await other.owner.error(LIST, { w: other.workspaceId, t: taskId })).code).toBe('NOT_FOUND');
  });

  it('refuses disguised files and deletes them', async () => {
    const ticket = await upload(member, 'invoice.pdf', Buffer.from('<html><script>alert(1)</script></html>'));
    expect(await complete(member, ticket)).toEqual({ attachment: null, error: "This file's contents don't match an allowed type" });
    expect((await member.error(COMPLETE, { w, a: ticket.attachmentId })).code).toBe('NOT_FOUND');
    expect((await member.error(REQUEST, { w, input: { taskId, fileName: 'logo.svg', size: 10 } })).code).toBe('BAD_USER_INPUT');
  });

  it('lets the uploader, or someone who may delete tasks, remove a file', async () => {
    const mine = await complete(ws.owner, await upload(ws.owner, 'brief.txt', Buffer.from('the brief')));
    // A member who didn't add it, and can't delete tasks, can't remove it.
    expect((await member.error(DELETE, { w, a: mine.attachment!.id })).code).toBe('FORBIDDEN');
    const theirs = await complete(member, await upload(member, 'notes.md', Buffer.from('# notes')));
    expect((await member.data<{ deleteTaskAttachment: boolean }>(DELETE, { w, a: theirs.attachment!.id })).deleteTaskAttachment).toBe(true);
    // The owner may delete tasks, so may remove anyone's file.
    expect((await ws.owner.data<{ deleteTaskAttachment: boolean }>(DELETE, { w, a: mine.attachment!.id })).deleteTaskAttachment).toBe(true);
    expect((await fetch(ws.owner.baseUrl + mine.attachment!.url)).status).toBe(404);
  });

  it('keeps unfinished uploads to their uploader in the database itself', async () => {
    const ticket = await upload(member, 'draft.txt', Buffer.from('draft'));
    const db = runtimeDatabase();
    try {
      const seen = (userId: string) => withScope(db, { workspaceId: w, userId }, async (client) => (await client.query('SELECT id FROM task_attachment WHERE id = $1', [ticket.attachmentId])).rows);
      expect(await seen(member.id)).toHaveLength(1);
      expect(await seen(ws.owner.id)).toEqual([]);
    } finally {
      await db.end();
    }
  });
});
