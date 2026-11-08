import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_NOTICE = 3;
const TEXT = 'markdown';
const REMOTE = Symbol('remote');
/** Reconnect waits, in seconds, after the connection drops. */
const BACKOFF = [1, 2, 5, 10];
/** Gives up on live editing if the first connection hasn't synced in this time. */
const FIRST_CONNECT_TIMEOUT_MS = 6_000;

/**
 * connecting: not synced yet (editing waits). live: synced. offline: dropped, reconnecting;
 * edits keep working and merge when back. unavailable: live editing can't be used here
 * (refused, or never connected); the page falls back to saving on its own.
 */
export type LiveStatus = 'connecting' | 'live' | 'offline' | 'unavailable';

export interface LivePeerView {
  clientId: number;
  id: string;
  name: string;
  canEdit: boolean;
  /** The line their cursor is on, counted from 1. */
  line: number | null;
}

export interface LiveSnapshot {
  status: LiveStatus;
  text: string;
  readOnly: boolean;
  peers: readonly LivePeerView[];
  savedAt: string | null;
  /** Some change (yours or someone's) hasn't been saved yet. */
  pending: boolean;
  error: string | null;
}

/** Maps a position in the old text to the new one after a remote change. */
export type IndexMap = (index: number) => number;

/**
 * A page's live connection (C5): a Yjs document whose shared text is the page's markdown,
 * kept in sync with everyone else on /api/docs/live. The server seeds the text; this side
 * never inserts the starting content. Presence carries only a cursor line: the server adds
 * who you are from your session.
 */
export class LiveDoc {
  private doc = new Y.Doc();
  private awareness = new awarenessProtocol.Awareness(this.doc);
  private ws: WebSocket | null = null;
  private attempts = 0;
  private everLive = false;
  private lineage: string | null = null;
  /** Local text that hasn't reached the server, for starting over on a new history. */
  private unsynced: string | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private firstTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Offline edits to put back after starting over on a new history. */
  private rebase: string | null = null;
  private destroyed = false;
  private readonly listeners = new Set<() => void>();
  private readonly remoteListeners = new Set<(map: IndexMap) => void>();
  private snapshot: LiveSnapshot = { status: 'connecting', text: '', readOnly: false, peers: [], savedAt: null, pending: false, error: null };

  constructor(
    private readonly workspaceId: string,
    private readonly documentId: string,
  ) {
    this.attach();
    this.connect();
    this.firstTimeout = setTimeout(() => {
      if (!this.everLive) this.giveUp(null);
    }, FIRST_CONNECT_TIMEOUT_MS);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): LiveSnapshot => this.snapshot;

  /** Called after someone else's change, with a way to move a caret along with it. */
  onRemoteChange(listener: (map: IndexMap) => void): () => void {
    this.remoteListeners.add(listener);
    return () => this.remoteListeners.delete(listener);
  }

  /** Replaces the text with `next`, as the smallest edit that gets there. */
  setText(next: string): void {
    if (this.snapshot.readOnly || this.snapshot.status === 'connecting' || this.snapshot.status === 'unavailable') return;
    const text = this.doc.getText(TEXT);
    const current = text.toString();
    if (current === next) return;
    const { start, removed, inserted } = diff(current, next);
    this.doc.transact(() => {
      if (removed) text.delete(start, removed);
      if (inserted) text.insert(start, inserted);
    });
  }

  /** Shares which line your cursor is on. */
  setCursorLine(line: number | null): void {
    const current = (this.awareness.getLocalState() as { cursor?: { line: number | null } } | null)?.cursor?.line ?? null;
    if (current === line && this.awareness.getLocalState()) return;
    this.awareness.setLocalState({ cursor: { line } });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.firstTimeout) clearTimeout(this.firstTimeout);
    this.ws?.close(1000);
    this.awareness.destroy();
    this.doc.destroy();
    this.listeners.clear();
    this.remoteListeners.clear();
  }

  private attach(): void {
    const text = this.doc.getText(TEXT);
    text.observe((event, transaction) => {
      // Changes during the first sync are the page as stored, not edits.
      this.update({ text: text.toString(), pending: this.snapshot.pending || this.snapshot.status !== 'connecting' });
      if (transaction.origin === REMOTE) {
        const delta = event.delta;
        const map: IndexMap = (index) => mapIndex(index, delta);
        for (const listener of this.remoteListeners) listener(map);
      }
    });
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return;
      if (this.snapshot.status !== 'live') this.unsynced = text.toString();
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.send(encoding.toUint8Array(encoder));
    });
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin !== REMOTE) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed]));
        this.send(encoding.toUint8Array(encoder));
      }
      this.update({ peers: this.readPeers() });
    });
  }

  private connect(): void {
    if (this.destroyed) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/docs/live?workspaceId=${this.workspaceId}&documentId=${this.documentId}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => this.receive(new Uint8Array(event.data));
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      awarenessProtocol.removeAwarenessStates(this.awareness, [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID), REMOTE);
      if (this.destroyed) return;
      // Refused for good: signed out, no access, or a page that can't be edited live.
      if (event.code === 4401 || event.code === 4403 || event.code === 4413 || event.code === 4429) return this.giveUp(event.reason || 'Live editing stopped');
      if (!this.everLive) return this.giveUp(null);
      this.update({ status: 'offline' });
      const wait = BACKOFF[Math.min(this.attempts, BACKOFF.length - 1)]! * 1000;
      this.attempts++;
      this.retry = setTimeout(() => this.connect(), wait);
    };
  }

  private giveUp(error: string | null): void {
    if (this.firstTimeout) clearTimeout(this.firstTimeout);
    this.ws?.close(1000);
    this.ws = null;
    this.update({ status: 'unavailable', error });
  }

  private receive(message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    if (type === MESSAGE_NOTICE) return this.notice(JSON.parse(decoding.readVarString(decoder)) as { type: string; lineage?: string; at?: string; message?: string });
    if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), REMOTE);
      return;
    }
    if (type !== MESSAGE_SYNC) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    const sub = syncProtocol.readSyncMessage(decoder, encoder, this.doc, REMOTE);
    if (encoding.length(encoder) > 1) this.send(encoding.toUint8Array(encoder));
    if (sub === syncProtocol.messageYjsSyncStep2) this.synced();
  }

  private notice(notice: { type: string; lineage?: string; at?: string; message?: string }): void {
    if (notice.type === 'hello' && notice.lineage) {
      if (this.lineage && this.lineage !== notice.lineage) this.startOver();
      this.lineage = notice.lineage;
      // Now tell the server what we have; it answers with the rest.
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.send(encoding.toUint8Array(encoder));
    } else if (notice.type === 'saved') {
      this.update({ savedAt: notice.at ?? null, pending: false, error: null });
    } else if (notice.type === 'error') {
      this.update({ error: notice.message ?? 'Could not save' });
    } else if (notice.type === 'read-only') {
      this.update({ readOnly: true });
    }
  }

  /**
   * The page has a new history (it was changed outside live editing): drop ours and sync
   * afresh. Anything typed while offline is put back on top as one edit once synced.
   */
  private startOver(): void {
    const pending = this.unsynced;
    this.awareness.destroy();
    this.doc.destroy();
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.attach();
    this.rebase = pending;
  }

  private synced(): void {
    this.attempts = 0;
    this.everLive = true;
    if (this.firstTimeout) clearTimeout(this.firstTimeout);
    this.update({ status: 'live', text: this.doc.getText(TEXT).toString() });
    this.unsynced = null;
    if (this.rebase !== null) {
      const pending = this.rebase;
      this.rebase = null;
      this.setText(pending);
    }
    // Presence again after a reconnect.
    const local = this.awareness.getLocalState();
    if (local) this.awareness.setLocalState(local);
  }

  private readPeers(): LivePeerView[] {
    const peers: LivePeerView[] = [];
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === this.doc.clientID) continue;
      const view = state as { user?: { id?: string; name?: string; canEdit?: boolean }; cursor?: { line?: number | null } };
      if (!view.user?.id) continue;
      peers.push({ clientId, id: view.user.id, name: view.user.name ?? 'Someone', canEdit: view.user.canEdit === true, line: view.cursor?.line ?? null });
    }
    return peers;
  }

  private send(message: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(message as Uint8Array<ArrayBuffer>);
  }

  private update(partial: Partial<LiveSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of this.listeners) listener();
  }
}

/** The single edit that turns `before` into `after`: common prefix and suffix kept. */
export function diff(before: string, after: string): { start: number; removed: number; inserted: string } {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  return { start, removed: before.length - start - end, inserted: after.slice(start, after.length - end) };
}

/** Where a position ends up after a change described as a Yjs delta. */
export function mapIndex(index: number, delta: readonly { retain?: number; insert?: unknown; delete?: number }[]): number {
  let position = 0;
  let result = index;
  for (const op of delta) {
    if (position > index) break;
    if (op.retain) {
      position += op.retain;
    } else if (typeof op.insert === 'string') {
      // Text inserted at or before the caret pushes it along.
      if (position <= index) result += op.insert.length;
    } else if (op.delete) {
      const removedBefore = Math.min(op.delete, Math.max(0, index - position));
      result -= removedBefore;
      position += op.delete;
    }
  }
  return Math.max(0, result);
}
