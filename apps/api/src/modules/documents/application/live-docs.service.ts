import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as Y from 'yjs';
import { DOC_CONTENT_MAX } from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, SessionUser, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { DocumentsService } from './documents.service.js';
import { LiveDocRelay, type RelayHandler } from '../domain/live-doc-relay.port.js';
import { encodeNotice, LiveDocRoom, type LiveHistory, type LivePeer } from './live-doc-room.js';

/** Saves come this long after the last change, and at least this often while people keep typing. */
const SAVE_DELAY_MS = 1_000;
const SAVE_MAX_WAIT_MS = 5_000;
/** Beyond this the page can't be saved; at twice this the room closes, so memory stays bounded. */
const ROOM_TEXT_HARD_MAX = DOC_CONTENT_MAX * 2;
/** Limits per page and per person, so a client can't open sockets without end. */
export const LIVE_PEERS_PER_ROOM = 50;
/** Matches the database check on document.live_state; a longer history isn't kept. */
const LIVE_STATE_MAX_BYTES = 4 * 1024 * 1024;
export const LIVE_CONNECTIONS_PER_USER = 20;
/** How long a newly opened room listens for other instances that have the page open already. */
const HELLO_WAIT_MS = 300;
/** Closes people's connections so they reconnect; the browser does so by itself. */
const RECONNECT_CODE = 4409;
/** How long a save waits for another instance's save of the same page. */
const SAVE_LOCK_WAIT_MS = 5_000;

/** What instances tell each other about a page. */
const enum Relay {
  /** "I just opened this page": everyone with it open answers with State. */
  Hello = 0,
  /** One instance's full history, sent to the one that asked. */
  State = 1,
  Update = 2,
  Presence = 3,
  Saved = 4,
}

export interface LiveSession {
  user: SessionUser;
  workspaceId: string;
  documentId: string;
}

interface RoomState {
  room: LiveDocRoom;
  key: string;
  /** When this history was opened here; across instances, the oldest room's history wins. */
  openedAt: number;
  /** Replaced by another instance's history; nobody new joins it, and it isn't saved. */
  stale: boolean;
  relay: RelayHandler | null;
  workspaceId: string;
  documentId: string;
  timer: NodeJS.Timeout | null;
  firstPendingAt: number | null;
  saving: Promise<void> | null;
  /** Each peer's session, to re-check access when saving. */
  sessions: Map<LivePeer, LiveSession>;
}

/**
 * Live co-editing of pages (C5). Each open page is a room on this API instance. With Redis,
 * rooms for the same page on different instances share every change and presence through
 * the relay, so people can reach any instance. A room opened while another instance already
 * has the page continues that instance's history; if two histories ever meet (opened at the
 * same moment), the older room's wins and the newer one's people reconnect to it.
 *
 * Changes are saved through DocumentsService.update by the instance where the latest change
 * was made, as the person who made it, with their current access, so the usual permission
 * checks, sanitizing, events and cache invalidation all apply.
 */
@Injectable()
export class LiveDocsService implements OnModuleDestroy {
  private readonly logger = new Logger(LiveDocsService.name);
  private readonly rooms = new Map<string, RoomState>();
  private readonly perUser = new Map<string, number>();

  constructor(
    private readonly documents: DocumentsService,
    private readonly accessService: AccessService,
    private readonly transactional: TransactionalManager,
    private readonly relay: LiveDocRelay,
  ) {
    // Messages may have been lost while Redis was away: rooms ask for everyone's state again.
    this.relay.onReconnect(() => {
      for (const state of this.rooms.values()) this.hello(state);
    });
  }

  /** Checks access and returns what this person may do; throws DomainError when they may not open it. */
  async authorize(session: LiveSession): Promise<{ access: WorkspaceAccess; content: string; canEdit: boolean; live: { state: Uint8Array; lineage: string } | null }> {
    const access = await this.accessService.resolve(session.user, session.workspaceId);
    if (!access?.permissions.has('doc.view')) throw DomainError.notFound('Page');
    const opened = await this.inScope(access, session.user.id, () => this.documents.openLive(access, session.user.id, session.documentId));
    return { access, ...opened };
  }

  /** Adds a connection to the page's room, opening the room (from the database) if needed. */
  async join(session: LiveSession, peer: LivePeer, content: string, live: LiveHistory | null): Promise<RoomState> {
    const count = this.perUser.get(session.user.id) ?? 0;
    if (count >= LIVE_CONNECTIONS_PER_USER) throw DomainError.conflict('Too many pages open live');
    const state = await this.room(session, content, live);
    if (state.room.size >= LIVE_PEERS_PER_ROOM) throw DomainError.conflict('Too many people on this page');
    this.perUser.set(session.user.id, count + 1);
    state.sessions.set(peer, session);
    state.room.join(peer);
    return state;
  }

  async leave(state: RoomState, peer: LivePeer): Promise<void> {
    if (!state.sessions.has(peer)) return;
    // Their own unsaved changes are saved as them before they go.
    if (!state.stale && state.room.dirty && state.room.lastEditor === peer) await this.save(state);
    state.sessions.delete(peer);
    const userId = peer.userId;
    const count = (this.perUser.get(userId) ?? 1) - 1;
    if (count <= 0) this.perUser.delete(userId);
    else this.perUser.set(userId, count);
    state.room.leave(peer);
    if (state.room.size > 0) return;
    // The last person left: save what's pending, then forget the room.
    await this.save(state);
    if (state.room.size === 0 && (state.stale || this.rooms.get(state.key) === state)) this.close(state);
  }

  private close(state: RoomState): void {
    if (this.rooms.get(state.key) === state) this.rooms.delete(state.key);
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    if (state.relay) void this.relay.unsubscribe(state.key, state.relay);
    state.relay = null;
    state.room.destroy();
  }

  /** The people in a page's room right now; for tests and diagnostics. */
  peersIn(workspaceId: string, documentId: string): number {
    return this.rooms.get(`${workspaceId}:${documentId}`)?.room.size ?? 0;
  }

  private readonly opening = new Map<string, Promise<RoomState>>();

  private room(session: LiveSession, content: string, live: LiveHistory | null): Promise<RoomState> {
    const key = `${session.workspaceId}:${session.documentId}`;
    const existing = this.rooms.get(key);
    if (existing) return Promise.resolve(existing);
    const pending = this.opening.get(key);
    if (pending) return pending;
    const opening = this.open(key, session, content, live).finally(() => this.opening.delete(key));
    this.opening.set(key, opening);
    return opening;
  }

  private async open(key: string, session: LiveSession, content: string, live: LiveHistory | null): Promise<RoomState> {
    const state: RoomState = {
      key,
      openedAt: Date.now(),
      stale: false,
      relay: null,
      workspaceId: session.workspaceId,
      documentId: session.documentId,
      timer: null,
      firstPendingAt: null,
      saving: null,
      sessions: new Map(),
      room: undefined as unknown as LiveDocRoom,
    };
    state.room = this.makeRoom(state, content, live);
    if (this.relay.enabled) {
      const handler: RelayHandler = (message) => this.relayed(state, message);
      state.relay = handler;
      try {
        await this.relay.subscribe(key, handler);
        this.hello(state);
        // Instances that have the page open answer with their history; the room takes it in.
        await new Promise((resolve) => setTimeout(resolve, HELLO_WAIT_MS));
      } catch (error) {
        // Without the relay this room works alone, as with a single instance.
        this.logger.warn(`Live editing relay unavailable for ${key}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    this.rooms.set(key, state);
    return state;
  }

  private makeRoom(state: RoomState, content: string, history: LiveHistory | null): LiveDocRoom {
    const room = new LiveDocRoom(state.key, content, history, () => this.changed(state));
    if (this.relay.enabled) {
      room.outbound = {
        update: (update) => this.send(state, Relay.Update, (encoder) => {
          encoding.writeVarString(encoder, room.lineage);
          encoding.writeVarUint8Array(encoder, update);
        }),
        presence: (update) => this.send(state, Relay.Presence, (encoder) => encoding.writeVarUint8Array(encoder, update)),
      };
    }
    return room;
  }

  private send(state: RoomState, kind: Relay, write: (encoder: encoding.Encoder) => void): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarString(encoder, this.relay.instanceId);
    encoding.writeVarUint(encoder, kind);
    write(encoder);
    this.relay.publish(state.key, encoding.toUint8Array(encoder));
  }

  private hello(state: RoomState): void {
    this.send(state, Relay.Hello, (encoder) => encoding.writeVarString(encoder, state.room.lineage));
  }

  private sendState(state: RoomState, to: string): void {
    this.send(state, Relay.State, (encoder) => {
      encoding.writeVarString(encoder, to);
      encoding.writeVarString(encoder, state.room.lineage);
      encoding.writeFloat64(encoder, state.openedAt);
      encoding.writeVarUint8Array(encoder, state.room.encodeState());
      encoding.writeVarUint8Array(encoder, state.room.encodePresence() ?? new Uint8Array());
    });
  }

  /** A message from another instance about this page. Throws on a malformed one (the relay drops it). */
  private relayed(state: RoomState, message: Uint8Array): void {
    if (state.stale) return;
    const decoder = decoding.createDecoder(message);
    const from = decoding.readVarString(decoder);
    if (from === this.relay.instanceId) return;
    const { room } = state;
    switch (decoding.readVarUint(decoder) as Relay) {
      case Relay.Hello:
        this.sendState(state, from);
        // A different history from an instance that doesn't know ours yet: ours may win.
        if (decoding.readVarString(decoder) !== room.lineage) this.hello(state);
        return;
      case Relay.State: {
        if (decoding.readVarString(decoder) !== this.relay.instanceId) return;
        const lineage = decoding.readVarString(decoder);
        const openedAt = decoding.readFloat64(decoder);
        const history = decoding.readVarUint8Array(decoder);
        const presence = decoding.readVarUint8Array(decoder);
        if (lineage === room.lineage) {
          room.applyRelayed(history);
        } else if (openedAt < state.openedAt || (openedAt === state.openedAt && from < this.relay.instanceId)) {
          this.adopt(state, { state: history, lineage, trusted: true }, openedAt);
        } else {
          // Ours is older: they take ours.
          this.sendState(state, from);
          return;
        }
        if (presence.byteLength) state.room.applyRelayedPresence(presence);
        return;
      }
      case Relay.Update:
        if (decoding.readVarString(decoder) !== room.lineage) return;
        room.applyRelayed(decoding.readVarUint8Array(decoder));
        return;
      case Relay.Presence:
        room.applyRelayedPresence(decoding.readVarUint8Array(decoder));
        return;
      case Relay.Saved: {
        room.broadcast(encodeNotice({ type: 'saved', at: decoding.readVarString(decoder).slice(0, 40) }));
        if (room.dirty && room.coveredBy(Y.decodeStateVector(decoding.readVarUint8Array(decoder)))) room.dirty = false;
        return;
      }
      default:
        throw new Error('Unknown relay message');
    }
  }

  /** Takes another instance's (older) history in place of this room's. */
  private adopt(state: RoomState, history: LiveHistory, openedAt: number): void {
    if (state.room.size === 0) {
      // Nobody here yet (the room is just opening): swap the history in.
      state.room.destroy();
      state.room = this.makeRoom(state, '', history);
      state.openedAt = openedAt;
      return;
    }
    // People here hold the other history: they reconnect and get the older room's.
    this.logger.warn(`Two live histories met for ${state.key}; this instance's people reconnect`);
    state.stale = true;
    state.room.dirty = false;
    if (this.rooms.get(state.key) === state) this.rooms.delete(state.key);
    for (const peer of state.room.people) peer.close(RECONNECT_CODE, 'Reconnecting to the page');
  }

  private changed(state: RoomState): void {
    if (state.room.text.length > ROOM_TEXT_HARD_MAX) {
      // Far beyond what a page may hold: close the room without saving.
      for (const peer of state.room.people) peer.close(4413, 'This page got too long to edit live');
      return;
    }
    const now = Date.now();
    state.firstPendingAt ??= now;
    if (state.timer) clearTimeout(state.timer);
    const wait = Math.max(0, Math.min(SAVE_DELAY_MS, state.firstPendingAt + SAVE_MAX_WAIT_MS - now));
    state.timer = setTimeout(() => void this.save(state), wait);
    state.timer.unref();
  }

  /** Saves the room's text if it changed. Never throws: failures are told to the editors. */
  async save(state: RoomState): Promise<void> {
    if (state.saving) await state.saving;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.firstPendingAt = null;
    if (!state.room.dirty || state.stale) return;
    state.saving = this.saveLocked(state).finally(() => {
      state.saving = null;
    });
    await state.saving;
  }

  /** One instance saves a page at a time; one that waited may find its changes saved already. */
  private async saveLocked(state: RoomState): Promise<void> {
    const release = await this.saveLock(state);
    try {
      if (state.room.dirty && !state.stale) await this.persist(state);
    } finally {
      await release();
    }
  }

  private async saveLock(state: RoomState): Promise<() => Promise<void>> {
    const deadline = Date.now() + SAVE_LOCK_WAIT_MS;
    for (;;) {
      try {
        const release = await this.relay.lock(state.key);
        if (release) return release;
      } catch (error) {
        this.logger.warn(`Saving ${state.key} without the save lock: ${error instanceof Error ? error.message : 'unknown error'}`);
        return () => Promise.resolve();
      }
      if (Date.now() > deadline || !state.room.dirty) return () => Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  private async persist(state: RoomState): Promise<void> {
    const { room } = state;
    const editor = room.lastEditor;
    const session = editor ? state.sessions.get(editor) : undefined;
    const content = room.text;
    const version = room.version();
    room.dirty = false;
    if (!editor || !session) return;
    if (content.length > DOC_CONTENT_MAX) {
      room.dirty = true;
      room.broadcast(encodeNotice({ type: 'error', message: `Pages can be at most ${DOC_CONTENT_MAX.toLocaleString('en')} characters; shorten it to save` }));
      return;
    }
    try {
      // Their access now, not when they connected: a role change or removal counts at once.
      const access = await this.accessService.resolve(session.user, state.workspaceId);
      if (!access) throw DomainError.forbidden('You are no longer in this workspace');
      const actor: Actor = { userId: session.user.id, platformRole: session.user.platformRole, ip: null };
      const saved = await this.inScope(
        access,
        actor.userId,
        async () => {
          const result = await this.documents.update(actor, access, state.documentId, { content });
          // Stored text may differ (the sanitizer); everyone moves to what was stored.
          room.replaceText(result.content);
          const history = room.encodeState();
          const fits = history.byteLength <= LIVE_STATE_MAX_BYTES;
          await this.documents.saveLiveState(access, state.documentId, fits ? history : null, fits ? room.lineage : null);
          return result;
        },
        false,
      );
      room.broadcast(encodeNotice({ type: 'saved', at: saved.updatedAt }));
      if (this.relay.enabled) {
        // Other instances skip saving when this version already holds their changes.
        const savedVersion = Y.encodeStateVector(room.withOwnChanges(version));
        this.send(state, Relay.Saved, (encoder) => {
          encoding.writeVarString(encoder, saved.updatedAt);
          encoding.writeVarUint8Array(encoder, savedVersion);
        });
      }
    } catch (error) {
      room.dirty = true;
      const message = error instanceof DomainError ? error.message : 'Could not save the page';
      if (!(error instanceof DomainError)) this.logger.error(`Live save failed for ${state.documentId}`, error instanceof Error ? error.stack : String(error));
      editor.send(encodeNotice({ type: 'error', message }));
      if (error instanceof DomainError && (error.kind === 'forbidden' || error.kind === 'not_found')) {
        // They can't change it any more: their further changes are dropped.
        editor.canEdit = false;
        editor.send(encodeNotice({ type: 'read-only' }));
        room.lastEditor = room.people.find((peer) => peer.canEdit) ?? null;
      }
    }
  }

  private inScope<T>(access: WorkspaceAccess, userId: string, work: () => Promise<T>, readOnly = true): Promise<T> {
    const scope = { kind: 'workspace' as const, workspaceId: access.workspaceId, userId, ...(access.spaceRules.length ? { spaceRules: access.spaceRules } : {}) };
    return this.transactional.runInScope(scope, work, { readOnly });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.rooms.values()].map((state) => this.save(state)));
    for (const state of [...this.rooms.values()]) this.close(state);
    this.rooms.clear();
  }
}
