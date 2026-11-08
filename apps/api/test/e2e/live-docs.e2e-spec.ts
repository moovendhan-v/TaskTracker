import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { LiveDocClient } from './support/live-doc-client.js';

const CREATE = 'mutation($w: ID!, $input: CreateDocumentInput!) { createDocument(workspaceId: $w, input: $input) { id } }';
const READ = 'query($w: ID!, $d: ID!) { document(workspaceId: $w, documentId: $d) { content } }';

async function open(user: TestUser | null, w: string, d: string, options?: { origin?: string | null }): Promise<LiveDocClient> {
  const client = await LiveDocClient.open(user, w, d, options);
  if (!(client instanceof LiveDocClient)) throw new Error(`Refused with ${client.refused}`);
  return client;
}

/** C5: editing a page together, live. */
describe('live pages', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let writer: TestUser;
  let guest: TestUser;

  beforeAll(async () => {
    ws = await createWorkspace('Live owner');
    w = ws.workspaceId;
    writer = await TestUser.signUp('Live writer');
    guest = await TestUser.signUp('Live guest');
    await addMember(ws, writer, 'Member');
    await addMember(ws, guest, 'Guest');
  });

  const newPage = async (content: string, user = ws.owner) => (await user.data<{ createDocument: { id: string } }>(CREATE, { w, input: { title: 'Live', content } })).createDocument.id;
  const stored = async (d: string) => (await ws.owner.data<{ document: { content: string } }>(READ, { w, d })).document;
  const updatedBy = (d: string) =>
    withScope(runtimeDatabase(), { workspaceId: w }, async (client) => (await client.query<{ id: string }>('SELECT updated_by_id AS id FROM document WHERE id = $1', [d])).rows[0]?.id);

  it('shares every change at once and saves it', async () => {
    const d = await newPage('Hello');
    const a = await open(ws.owner, w, d);
    const b = await open(ws.owner, w, d);
    // Both start from the stored text, once: the server seeds it, not the clients.
    expect(a.text).toBe('Hello');
    expect(b.text).toBe('Hello');

    a.insert(5, ' world');
    b.insert(0, '# ');
    await a.until(() => a.text === '# Hello world');
    await b.until(() => b.text === '# Hello world');
    await a.until(() => a.notices.some((notice) => notice.type === 'saved'));
    expect((await stored(d)).content).toBe('# Hello world');
    await a.close();
    await b.close();
  });

  it('shows who is here, with names from the session', async () => {
    const d = await newPage('Presence');
    const a = await open(ws.owner, w, d);
    const b = await open(writer, w, d);
    b.setPresence({ cursor: { anchor: 1 }, user: { id: 'someone-else', name: 'Not me' } });
    await a.until(() => a.peers().some((peer) => peer.user?.name === 'Live writer'));
    expect(a.peers().find((peer) => peer.user?.name === 'Live writer')?.user?.id).toBe(writer.id);
    expect(a.peers().some((peer) => peer.user?.name === 'Not me')).toBe(false);
    await b.close();
    await a.until(() => a.peers().length === 0);
    await a.close();
  });

  it("lets people who can't edit watch, and drops their changes", async () => {
    // A member can edit only their own pages; this one is the owner's.
    const d = await newPage('Owner text');
    const owner = await open(ws.owner, w, d);
    const reader = await open(writer, w, d);
    await reader.until(() => reader.notices.some((notice) => notice.type === 'read-only'));
    reader.insert(0, 'Sneaky ');
    owner.insert(10, '!');
    await reader.until(() => reader.text.endsWith('!'));
    await owner.until(() => owner.notices.some((notice) => notice.type === 'saved'));
    expect(owner.text).toBe('Owner text!');
    expect((await stored(d)).content).toBe('Owner text!');
    await reader.close();
    await owner.close();
  });

  it('saves what is pending when the last person leaves', async () => {
    const d = await newPage('', writer);
    const client = await open(writer, w, d);
    client.insert(0, 'Typed and gone');
    await client.close();
    await expect.poll(async () => (await stored(d)).content, { timeout: 5_000 }).toBe('Typed and gone');
    expect(await updatedBy(d)).toBe(writer.id);
  });

  it('keeps the same history between sessions, and starts a new one after an outside edit', async () => {
    const d = await newPage('One');
    const first = await open(ws.owner, w, d);
    first.insert(3, ' two');
    await first.close();
    await expect.poll(async () => (await stored(d)).content, { timeout: 5_000 }).toBe('One two');

    const second = await open(ws.owner, w, d);
    expect(second.text).toBe('One two');
    expect(second.lineage).toBe(first.lineage);
    await second.close();

    // Saved without live editing (an older client, the API): the next room starts afresh.
    await ws.owner.data('mutation($w: ID!, $d: ID!) { updateDocument(workspaceId: $w, documentId: $d, input: { content: "Rewritten" }) { id } }', { w, d });
    const third = await open(ws.owner, w, d);
    expect(third.text).toBe('Rewritten');
    expect(third.lineage).not.toBe(first.lineage);
    await third.close();
  });

  it('stores what the sanitizer keeps, and everyone moves to it', async () => {
    const d = await newPage('Safe');
    const client = await open(ws.owner, w, d);
    client.insert(4, ' [click](javascript:alert(1))');
    await client.until(() => client.notices.some((notice) => notice.type === 'saved'));
    const content = (await stored(d)).content;
    expect(content).toBe('Safe [click](#blocked-link:alert(1))');
    await client.until(() => client.text === content);
    await client.close();
  });

  it('refuses other sites, strangers, and people who cannot read the page', async () => {
    const d = await newPage('Private');
    expect(await LiveDocClient.open(ws.owner, w, d, { origin: 'https://evil.example.com' })).toEqual({ refused: 403 });
    expect(await LiveDocClient.open(ws.owner, w, d, { origin: null })).toEqual({ refused: 403 });
    expect(await LiveDocClient.open(null, w, d)).toEqual({ refused: 401 });
    const outsider = await TestUser.signUp('Live outsider');
    expect(await LiveDocClient.open(outsider, w, d)).toEqual({ refused: 404 });
    expect(await LiveDocClient.open(ws.owner, w, '00000000-0000-4000-8000-000000000000')).toEqual({ refused: 404 });
    expect(await LiveDocClient.open(ws.owner, w, 'not-a-uuid')).toEqual({ refused: 400 });
  });

  it('lets guests read along, never write', async () => {
    const d = await newPage('Guest view');
    const reader = await open(guest, w, d);
    await reader.until(() => reader.notices.some((notice) => notice.type === 'read-only'));
    expect(reader.text).toBe('Guest view');
    reader.insert(0, 'x');
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect((await stored(d)).content).toBe('Guest view');
    await reader.close();
  });

  it('limits how often one address opens connections', async () => {
    const d = await newPage('Busy');
    const flood = new TestUser('Live flood');
    const results: unknown[] = [];
    for (let attempt = 0; attempt < 32; attempt++) results.push(await LiveDocClient.open(flood, w, d));
    expect(results).toContainEqual({ refused: 429 });
  });

  it('closes on a malformed message', async () => {
    const d = await newPage('Garbage');
    const client = await open(ws.owner, w, d);
    client.sendRaw(new Uint8Array([9, 9, 9]));
    await client.until(() => client.closed !== null);
    expect(client.closed?.code).toBe(4400);
  });
});
