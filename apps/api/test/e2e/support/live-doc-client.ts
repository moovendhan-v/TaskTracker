import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import { inject } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import type { TestUser } from './api-client.js';
import { TEST_ORIGIN } from './test-env.js';

/** A browser-like live editing client (C5): a Yjs document synced over /api/docs/live. */
export class LiveDocClient {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  readonly notices: { type: string; message?: string; at?: string; lineage?: string }[] = [];
  closed: { code: number; reason: string } | null = null;
  private synced = false;

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (data: Buffer) => this.receive(new Uint8Array(data)));
    ws.on('close', (code, reason) => (this.closed = { code, reason: reason.toString() }));
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      syncProtocol.writeUpdate(encoder, update);
      this.send(encoding.toUint8Array(encoder));
    });
  }

  /** Opens a connection; resolves once the first sync finished, or with the refusal status. */
  static async open(user: TestUser | null, workspaceId: string, documentId: string, { origin = TEST_ORIGIN }: { origin?: string | null } = {}): Promise<LiveDocClient | { refused: number }> {
    const url = `${inject('apiUrl').replace(/^http/, 'ws')}/api/docs/live?workspaceId=${workspaceId}&documentId=${documentId}`;
    const headers: Record<string, string> = { ...(origin && { Origin: origin }), ...(user && { Cookie: user.cookieHeader(), 'X-Forwarded-For': user.ip }) };
    const ws = new WebSocket(url, { headers });
    return new Promise((resolve) => {
      ws.once('unexpected-response', (_request, response) => resolve({ refused: response.statusCode ?? 0 }));
      ws.once('error', () => resolve({ refused: 0 }));
      ws.once('open', () => {
        const client = new LiveDocClient(ws);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0);
        syncProtocol.writeSyncStep1(encoder, client.doc);
        client.send(encoding.toUint8Array(encoder));
        void client.until(() => client.synced, 5_000).then(() => resolve(client));
      });
    });
  }

  /** The history the server said this page has. */
  get lineage(): string | undefined {
    return this.notices.find((notice) => notice.type === 'hello')?.lineage;
  }

  get text(): string {
    return this.doc.getText('markdown').toString();
  }

  insert(index: number, value: string): void {
    this.doc.getText('markdown').insert(index, value);
  }

  /** Sets this client's presence; the server fills in who they are. */
  setPresence(state: Record<string, unknown>): void {
    this.awareness.setLocalState(state);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    this.send(encoding.toUint8Array(encoder));
  }

  peers(): { user?: { id: string; name: string } }[] {
    return [...this.awareness.getStates().entries()].filter(([id]) => id !== this.doc.clientID).map(([, state]) => state as { user?: { id: string; name: string } });
  }

  sendRaw(message: Uint8Array): void {
    this.send(message);
  }

  async until(check: () => boolean, timeoutMs = 5_000): Promise<void> {
    const end = Date.now() + timeoutMs;
    while (!check()) {
      if (Date.now() > end) throw new Error('Timed out waiting for the live page');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.ws.close();
    return this.until(() => this.closed !== null);
  }

  private send(message: Uint8Array): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(message);
  }

  private receive(message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    if (type === 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      const sub = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
      if (encoding.length(encoder) > 1) this.send(encoding.toUint8Array(encoder));
      if (sub === syncProtocol.messageYjsSyncStep2) this.synced = true;
    } else if (type === 1) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
    } else if (type === 3) {
      this.notices.push(JSON.parse(decoding.readVarString(decoder)) as { type: string });
    }
  }
}
