import { randomUUID } from 'node:crypto';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

/** Message types on the wire: the y-websocket protocol, plus our own notices. */
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_NOTICE = 3;

/** The shared text's name in the Yjs document: the page's markdown. */
export const LIVE_TEXT = 'markdown';

/** A presence state (cursor, selection) larger than this is refused. */
const AWARENESS_STATE_MAX = 2_000;

export interface LivePeer {
  /** Sends one binary message; never throws. */
  send(message: Uint8Array): void;
  /** Ends the connection with a reason the client can show. */
  close(code: number, reason: string): void;
  readonly userId: string;
  readonly userName: string;
  /** Whether this person may change the page (doc.manage, or doc.create on their own page). */
  canEdit: boolean;
}

/** What the room tells the browser besides document changes. */
export type LiveNotice = { type: 'hello'; lineage: string } | { type: 'saved'; at: string } | { type: 'error'; message: string } | { type: 'read-only' };

export function encodeNotice(notice: LiveNotice): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_NOTICE);
  encoding.writeVarString(encoder, JSON.stringify(notice));
  return encoding.toUint8Array(encoder);
}

/**
 * One page being edited live (C5): a Yjs document holding the page's markdown as shared text,
 * and the people connected to it. The server is the source of truth: it seeds the text from
 * the database, so clients never insert the starting content themselves (which would double
 * it). People who may only read get every change but their own changes are dropped.
 */
export class LiveDocRoom {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  private readonly peers = new Map<LivePeer, Set<number>>();
  /** Who made the latest change, so the save is attributed to them. */
  lastEditor: LivePeer | null = null;
  dirty = false;
  /** Names this document's history; browsers holding another one start over instead of merging. */
  readonly lineage: string;

  constructor(
    readonly key: string,
    content: string,
    stored: { state: Uint8Array; lineage: string } | null,
    private readonly onChange: () => void,
  ) {
    // The server's own presence isn't shown to anyone.
    this.awareness.setLocalState(null);
    this.lineage = this.seed(content, stored);
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder));
      // Changes the server makes (after saving) aren't edits to save again.
      if (origin !== this) {
        this.dirty = true;
        if (origin && this.peers.has(origin as LivePeer)) this.lastEditor = origin as LivePeer;
        this.onChange();
      }
    });
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changed = [...added, ...updated, ...removed];
      if (changed.length === 0) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
      this.broadcast(encoding.toUint8Array(encoder));
    });
  }

  /**
   * Continues the stored history when it still matches the stored markdown; otherwise the
   * page changed outside live editing (or was never edited live), and a new history starts.
   */
  private seed(content: string, stored: { state: Uint8Array; lineage: string } | null): string {
    if (stored) {
      const probe = new Y.Doc();
      try {
        Y.applyUpdate(probe, stored.state);
        if (probe.getText(LIVE_TEXT).toString() === content) {
          Y.applyUpdate(this.doc, stored.state);
          return stored.lineage;
        }
      } catch {
        // A damaged history is dropped; the markdown is what counts.
      } finally {
        probe.destroy();
      }
    }
    this.doc.getText(LIVE_TEXT).insert(0, content);
    return randomUUID();
  }

  /** The history to store with the markdown. */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  get text(): string {
    return this.doc.getText(LIVE_TEXT).toString();
  }

  get size(): number {
    return this.peers.size;
  }

  get people(): readonly LivePeer[] {
    return [...this.peers.keys()];
  }

  /** Greets a new connection with the server's state and who else is here. */
  join(peer: LivePeer): void {
    this.peers.set(peer, new Set());
    // First, which history this is, so a browser holding another one starts over before syncing.
    peer.send(encodeNotice({ type: 'hello', lineage: this.lineage }));
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    peer.send(encoding.toUint8Array(encoder));
    const states = [...this.awareness.getStates().keys()];
    if (states.length) {
      const presence = encoding.createEncoder();
      encoding.writeVarUint(presence, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(presence, awarenessProtocol.encodeAwarenessUpdate(this.awareness, states));
      peer.send(encoding.toUint8Array(presence));
    }
    if (!peer.canEdit) peer.send(encodeNotice({ type: 'read-only' }));
  }

  leave(peer: LivePeer): void {
    const clients = this.peers.get(peer);
    this.peers.delete(peer);
    if (clients?.size) awarenessProtocol.removeAwarenessStates(this.awareness, [...clients], null);
    if (this.lastEditor === peer) this.lastEditor = this.people.find((other) => other.canEdit) ?? null;
  }

  /** Handles one message from a peer. Throws on a malformed message; the caller closes the socket. */
  receive(peer: LivePeer, message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    if (type === MESSAGE_SYNC) {
      const sub = decoding.readVarUint(decoder);
      if (sub === syncProtocol.messageYjsSyncStep1) {
        // They tell us what they have; we answer with what they're missing.
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeSyncStep2(encoder, this.doc, decoding.readVarUint8Array(decoder));
        peer.send(encoding.toUint8Array(encoder));
        return;
      }
      if (sub !== syncProtocol.messageYjsSyncStep2 && sub !== syncProtocol.messageYjsUpdate) throw new Error('Unknown sync message');
      const update = decoding.readVarUint8Array(decoder);
      // Readers' changes never reach the page.
      if (!peer.canEdit) return;
      Y.applyUpdate(this.doc, update, peer);
      return;
    }
    if (type === MESSAGE_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      this.applyPresence(peer, update);
      return;
    }
    throw new Error('Unknown message');
  }

  /**
   * Presence (cursor and selection). The name shown to others comes from the session, never
   * from the browser, so nobody can appear as someone else.
   */
  private applyPresence(peer: LivePeer, update: Uint8Array): void {
    const decoder = decoding.createDecoder(update);
    const count = decoding.readVarUint(decoder);
    const owned = this.peers.get(peer);
    if (!owned || count > 4) throw new Error('Too many presence states');
    const clean = encoding.createEncoder();
    encoding.writeVarUint(clean, count);
    for (let index = 0; index < count; index++) {
      const clientId = decoding.readVarUint(decoder);
      const clock = decoding.readVarUint(decoder);
      const json = decoding.readVarString(decoder);
      if (json.length > AWARENESS_STATE_MAX) throw new Error('Presence too large');
      // A client id someone else already holds can't be taken over.
      if (!owned.has(clientId) && this.ownerOf(clientId)) throw new Error('Presence belongs to someone else');
      owned.add(clientId);
      const state = JSON.parse(json) as unknown;
      const cursor = state && typeof state === 'object' && 'cursor' in state ? (state as { cursor: unknown }).cursor : null;
      const next = state === null ? null : { cursor: cursor ?? null, user: { id: peer.userId, name: peer.userName, canEdit: peer.canEdit } };
      encoding.writeVarUint(clean, clientId);
      encoding.writeVarUint(clean, clock);
      encoding.writeVarString(clean, JSON.stringify(next));
    }
    awarenessProtocol.applyAwarenessUpdate(this.awareness, encoding.toUint8Array(clean), peer);
  }

  private ownerOf(clientId: number): LivePeer | null {
    for (const [peer, clients] of this.peers) if (clients.has(clientId)) return peer;
    return null;
  }

  /** Replaces the text with what was stored (the sanitizer may have changed it), as one change. */
  replaceText(next: string): void {
    const text = this.doc.getText(LIVE_TEXT);
    const current = text.toString();
    if (current === next) return;
    let start = 0;
    while (start < current.length && start < next.length && current[start] === next[start]) start++;
    let end = 0;
    while (end < current.length - start && end < next.length - start && current[current.length - 1 - end] === next[next.length - 1 - end]) end++;
    this.doc.transact(() => {
      text.delete(start, current.length - start - end);
      text.insert(start, next.slice(start, next.length - end));
    }, this);
  }

  broadcast(message: Uint8Array): void {
    for (const peer of this.peers.keys()) peer.send(message);
  }

  destroy(): void {
    this.awareness.destroy();
    this.doc.destroy();
  }
}
