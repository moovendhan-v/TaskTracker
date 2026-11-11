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

/** The shared texts in the Yjs document: the page's markdown and its title. */
export const LIVE_TEXT = 'markdown';
export const LIVE_TITLE = 'title';

/** What a room starts from when there's no live history to continue. */
export interface LivePage {
  content: string;
  title: string;
}

/** The origin of changes that came from another API instance. */
export const RELAYED = Symbol('relayed');

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

/** A stored or shared history: `trusted` when it came from another instance's room, not the database. */
export interface LiveHistory {
  state: Uint8Array;
  lineage: string;
  trusted?: boolean;
}

/** What the room sends to other API instances: its own changes and presence (never relayed ones). */
export interface LiveOutbound {
  update(update: Uint8Array): void;
  presence(update: Uint8Array): void;
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
  /** Presence client ids of people on other instances; nobody here may take them over. */
  private readonly remoteClients = new Set<number>();
  /** Set when other instances share this page. */
  outbound: LiveOutbound | null = null;
  /** Who made the latest change, so the save is attributed to them. */
  lastEditor: LivePeer | null = null;
  dirty = false;
  /** Names this document's history; browsers holding another one start over instead of merging. */
  readonly lineage: string;

  constructor(
    readonly key: string,
    page: LivePage,
    stored: LiveHistory | null,
    private readonly onChange: () => void,
  ) {
    // The server's own presence isn't shown to anyone.
    this.awareness.setLocalState(null);
    this.lineage = this.seed(page, stored);
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder));
      // Another instance's change: the instance where it was made saves it.
      if (origin === RELAYED) return;
      this.outbound?.update(update);
      // Changes the server makes (after saving) aren't edits to save again.
      if (origin !== this) {
        this.dirty = true;
        if (origin && this.peers.has(origin as LivePeer)) this.lastEditor = origin as LivePeer;
        this.onChange();
      }
    });
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      const changed = [...added, ...updated, ...removed];
      if (changed.length === 0) return;
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder));
      // Only this instance's people are shared; a remote state timing out here isn't news elsewhere.
      const own = origin === RELAYED ? [] : changed.filter((id) => !this.remoteClients.has(id));
      for (const id of removed) this.remoteClients.delete(id);
      if (own.length && this.outbound) this.outbound.presence(own.length === changed.length ? update : awarenessProtocol.encodeAwarenessUpdate(this.awareness, own));
    });
  }

  /**
   * Continues the stored history when it still matches the stored markdown and title;
   * otherwise the page changed outside live editing (or was never edited live), and a new
   * history starts.
   */
  private seed(page: LivePage, stored: LiveHistory | null): string {
    if (stored?.trusted) {
      // Another instance's live room: its text is newer than the database's.
      Y.applyUpdate(this.doc, stored.state);
      return stored.lineage;
    }
    if (stored) {
      const probe = new Y.Doc();
      try {
        Y.applyUpdate(probe, stored.state);
        if (probe.getText(LIVE_TEXT).toString() === page.content && probe.getText(LIVE_TITLE).toString() === page.title) {
          Y.applyUpdate(this.doc, stored.state);
          return stored.lineage;
        }
      } catch {
        // A damaged history is dropped; the markdown is what counts.
      } finally {
        probe.destroy();
      }
    }
    this.doc.transact(() => {
      this.doc.getText(LIVE_TEXT).insert(0, page.content);
      this.doc.getText(LIVE_TITLE).insert(0, page.title);
    }, this);
    return randomUUID();
  }

  /** The history to store with the markdown. */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  get text(): string {
    return this.doc.getText(LIVE_TEXT).toString();
  }

  get title(): string {
    return this.doc.getText(LIVE_TITLE).toString();
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
      // A client id someone else already holds (here or on another instance) can't be taken over.
      if (!owned.has(clientId) && (this.ownerOf(clientId) || this.remoteClients.has(clientId))) throw new Error('Presence belongs to someone else');
      owned.add(clientId);
      const state = JSON.parse(json) as unknown;
      const cursor = state && typeof state === 'object' && 'cursor' in state ? cleanCursor((state as { cursor: unknown }).cursor) : null;
      const next = state === null ? null : { cursor, user: { id: peer.userId, name: peer.userName, canEdit: peer.canEdit } };
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

  /** Applies a change made on another instance. Throws on a malformed update. */
  applyRelayed(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, RELAYED);
  }

  /** Applies presence from another instance (already checked there). */
  applyRelayedPresence(update: Uint8Array): void {
    const decoder = decoding.createDecoder(update);
    const count = decoding.readVarUint(decoder);
    for (let index = 0; index < count; index++) {
      const clientId = decoding.readVarUint(decoder);
      decoding.readVarUint(decoder);
      const json = decoding.readVarString(decoder);
      if (json !== 'null' && !this.ownerOf(clientId)) this.remoteClients.add(clientId);
    }
    awarenessProtocol.applyAwarenessUpdate(this.awareness, update, RELAYED);
  }

  /** Which changes the document holds now (client id → clock). */
  version(): Map<number, number> {
    return Y.decodeStateVector(Y.encodeStateVector(this.doc));
  }

  /** Adds the server's own latest change (after replaceText) to a version taken earlier. */
  withOwnChanges(version: Map<number, number>): Map<number, number> {
    return new Map(version).set(this.doc.clientID, Y.getState(this.doc.store, this.doc.clientID));
  }

  /** Whether a saved version includes every change this document holds. */
  coveredBy(version: Map<number, number>): boolean {
    for (const [client, clock] of this.version()) if ((version.get(client) ?? 0) < clock) return false;
    return true;
  }

  /** Everyone's presence here, for an instance that just opened the page. */
  encodePresence(): Uint8Array | null {
    const states = [...this.awareness.getStates().keys()];
    return states.length ? awarenessProtocol.encodeAwarenessUpdate(this.awareness, states) : null;
  }

  /** Replaces the text with what was stored (the sanitizer may have changed it), as one change. */
  replaceText(next: string, name: typeof LIVE_TEXT | typeof LIVE_TITLE = LIVE_TEXT): void {
    const text = this.doc.getText(name);
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

/** Where someone's cursor is, as shared with others: which text, its line, and exact positions. */
export interface LiveCursor {
  field: typeof LIVE_TEXT | typeof LIVE_TITLE;
  line: number | null;
  anchor: RelativePositionJson | null;
  head: RelativePositionJson | null;
}

/** A Yjs relative position (Y.relativePositionToJSON): after an item, or at the start/end of a text. */
interface RelativePositionJson {
  item?: { client: number; clock: number };
  tname?: string;
  assoc?: number;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function cleanPosition(value: unknown): RelativePositionJson | null {
  if (!value || typeof value !== 'object') return null;
  const { item, tname, assoc } = value as { item?: unknown; tname?: unknown; assoc?: unknown };
  const clean: RelativePositionJson = {};
  if (item && typeof item === 'object') {
    const { client, clock } = item as { client?: unknown; clock?: unknown };
    if (!isCount(client) || !isCount(clock)) return null;
    clean.item = { client, clock };
  } else if (tname === LIVE_TEXT || tname === LIVE_TITLE) {
    clean.tname = tname;
  } else {
    return null;
  }
  if (assoc === -1 || assoc === 0) clean.assoc = assoc;
  return clean;
}

/**
 * Keeps only the cursor fields others need, in their expected shapes: browsers draw these, so
 * nothing else a client sends passes through.
 */
export function cleanCursor(value: unknown): LiveCursor | null {
  if (!value || typeof value !== 'object') return null;
  const { field, line, anchor, head } = value as Record<string, unknown>;
  return {
    field: field === LIVE_TITLE ? LIVE_TITLE : LIVE_TEXT,
    line: isCount(line) && line <= 1_000_000 ? line : null,
    anchor: cleanPosition(anchor),
    head: cleanPosition(head),
  };
}
