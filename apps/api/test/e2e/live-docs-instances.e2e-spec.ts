import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { LiveDocClient } from './support/live-doc-client.js';

const API_ROOT = resolve(import.meta.dirname, '../..');
const CREATE = 'mutation($w: ID!, $input: CreateDocumentInput!) { createDocument(workspaceId: $w, input: $input) { id } }';
const READ = 'query($w: ID!, $d: ID!) { document(workspaceId: $w, documentId: $d) { content } }';

/** A Redis to share: E2E_REDIS_URL, or a throwaway redis-server when one is installed. */
const hasRedis = Boolean(process.env['E2E_REDIS_URL']) || spawnSync('redis-server', ['--version']).status === 0;

/** Set E2E_API_LOG_DIR to keep the extra instances' logs. */
const logTo = (name: string) => openSync(join(process.env['E2E_API_LOG_DIR']!, `${name}.log`), 'a');

function freePort(): Promise<number> {
  return new Promise((done, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? done(address.port) : reject(new Error('No port'))));
    });
  });
}

async function waitFor(check: () => Promise<boolean>, what: string, process?: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (process && process.exitCode !== null) throw new Error(`${what} exited with code ${process.exitCode}`);
    if (await check().catch(() => false)) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`${what} did not start`);
}

/** C5: people editing one page on different API instances, joined through Redis. */
describe.skipIf(!hasRedis)('live pages across API instances', () => {
  const processes: ChildProcess[] = [];
  const urls: string[] = [];
  let ws: WorkspaceFixture;

  beforeAll(async () => {
    let redisUrl = process.env['E2E_REDIS_URL'];
    if (!redisUrl) {
      const port = await freePort();
      const redis = spawn('redis-server', ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
      processes.push(redis);
      redisUrl = `redis://127.0.0.1:${port}`;
      await waitFor(async () => spawnSync('redis-cli', ['-p', String(port), 'ping'], { encoding: 'utf8' }).stdout.trim() === 'PONG', 'Redis', redis);
    }
    // Two more API instances on the same database, sharing that Redis.
    for (let index = 0; index < 2; index++) {
      const port = await freePort();
      const api = spawn('node', ['dist/main.js'], { cwd: API_ROOT, env: { ...inject('apiEnv'), PORT: String(port), REDIS_URL: redisUrl }, stdio: process.env['E2E_API_LOG_DIR'] ? ['ignore', logTo(`api-${index}`), logTo(`api-${index}`)] : 'ignore' });
      processes.push(api);
      const url = `http://127.0.0.1:${port}`;
      await waitFor(async () => (await fetch(`${url}/api/health`)).ok, `API instance ${index + 1}`, api);
      urls.push(url);
    }
    ws = await createWorkspace('Instances owner');
  });

  afterAll(() => {
    for (const child of processes.reverse()) child.kill('SIGTERM');
  });

  const newPage = async (content: string) => (await ws.owner.data<{ createDocument: { id: string } }>(CREATE, { w: ws.workspaceId, input: { title: 'Across', content } })).createDocument.id;
  const stored = async (d: string) => (await ws.owner.data<{ document: { content: string } }>(READ, { w: ws.workspaceId, d })).document.content;
  const open = async (instance: number, d: string) => {
    const client = await LiveDocClient.open(ws.owner, ws.workspaceId, d, { apiUrl: urls[instance] });
    if (!(client instanceof LiveDocClient)) throw new Error(`Refused with ${client.refused}`);
    return client;
  };

  it('shares changes and presence between instances, and saves them once', async () => {
    const d = await newPage('Shared');
    const a = await open(0, d);
    const b = await open(1, d);
    expect(b.lineage).toBe(a.lineage);

    a.insert(6, ' page');
    b.insert(0, '# ');
    await a.until(() => a.text === '# Shared page');
    await b.until(() => b.text === '# Shared page');

    b.setPresence({ cursor: { line: 1 } });
    await a.until(() => a.peers().some((peer) => peer.user?.id === ws.owner.id));

    // Saved by the instance where the last change was made; the other instance's people hear of it too.
    await a.until(() => a.notices.some((notice) => notice.type === 'saved'));
    await b.until(() => b.notices.some((notice) => notice.type === 'saved'));
    expect(await stored(d)).toBe('# Shared page');

    // Leaving clears presence on the other instance.
    await b.close();
    await a.until(() => a.peers().length === 0);
    await a.close();
  });

  it("continues another instance's unsaved history instead of the database's", async () => {
    const d = await newPage('Base');
    const a = await open(0, d);
    a.insert(4, ' unsaved');
    // Straight away, before the save on instance 1: instance 2 asks instance 1 for the page.
    const b = await open(1, d);
    expect(b.lineage).toBe(a.lineage);
    await b.until(() => b.text === 'Base unsaved');
    b.insert(0, '> ');
    await a.until(() => a.text === '> Base unsaved');
    await a.until(() => a.notices.some((notice) => notice.type === 'saved'));
    await b.close();
    await a.close();
    await new Promise((done) => setTimeout(done, 300));
    expect(await stored(d)).toBe('> Base unsaved');
  });

  it('agrees on one history when two instances open a page at the same moment', async () => {
    const d = await newPage('Race');
    const [a, b] = await Promise.all([open(0, d), open(1, d)]);
    expect(a.lineage).toBeTruthy();
    expect(b.lineage).toBe(a.lineage);
    a.insert(4, '!');
    b.insert(0, '¡');
    await a.until(() => a.text === '¡Race!');
    await b.until(() => b.text === '¡Race!');
    await b.close();
    await a.close();
  });

  it('cleans an unsafe link once, even while both instances have changes to save', async () => {
    const d = await newPage('Links');
    const a = await open(0, d);
    const b = await open(1, d);
    a.insert(0, '[x](javascript:alert(1)) ');
    b.insert(b.text.length, ' and more');
    const clean = '[x](#blocked-link:alert(1)) Links and more';
    await a.until(() => a.text === clean, 10_000);
    await b.until(() => b.text === clean, 10_000);
    await b.close();
    await a.close();
    await new Promise((done) => setTimeout(done, 300));
    expect(await stored(d)).toBe(clean);
  });
});
