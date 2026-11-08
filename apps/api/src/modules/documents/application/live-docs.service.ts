import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { DOC_CONTENT_MAX } from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, SessionUser, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { DocumentsService } from './documents.service.js';
import { encodeNotice, LiveDocRoom, type LivePeer } from './live-doc-room.js';

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

export interface LiveSession {
  user: SessionUser;
  workspaceId: string;
  documentId: string;
}

interface RoomState {
  room: LiveDocRoom;
  workspaceId: string;
  documentId: string;
  timer: NodeJS.Timeout | null;
  firstPendingAt: number | null;
  saving: Promise<void> | null;
  /** Each peer's session, to re-check access when saving. */
  sessions: Map<LivePeer, LiveSession>;
}

/**
 * Live co-editing of pages (C5). Each open page is a room on this API instance; people
 * editing the same page must reach the same instance (one instance, or routing by page).
 * Changes are saved through DocumentsService.update as the person who made the latest
 * change, with their current access, so the usual permission checks, sanitizing, events
 * and cache invalidation all apply.
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
  ) {}

  /** Checks access and returns what this person may do; throws DomainError when they may not open it. */
  async authorize(session: LiveSession): Promise<{ access: WorkspaceAccess; content: string; canEdit: boolean; live: { state: Uint8Array; lineage: string } | null }> {
    const access = await this.accessService.resolve(session.user, session.workspaceId);
    if (!access?.permissions.has('doc.view')) throw DomainError.notFound('Page');
    const opened = await this.inScope(access, session.user.id, () => this.documents.openLive(access, session.user.id, session.documentId));
    return { access, ...opened };
  }

  /** Adds a connection to the page's room, opening the room (from the database) if needed. */
  async join(session: LiveSession, peer: LivePeer, content: string, live: { state: Uint8Array; lineage: string } | null): Promise<RoomState> {
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
    if (state.room.dirty && state.room.lastEditor === peer) await this.save(state);
    state.sessions.delete(peer);
    const userId = peer.userId;
    const count = (this.perUser.get(userId) ?? 1) - 1;
    if (count <= 0) this.perUser.delete(userId);
    else this.perUser.set(userId, count);
    state.room.leave(peer);
    if (state.room.size > 0) return;
    // The last person left: save what's pending, then forget the room.
    await this.save(state);
    if (state.room.size === 0 && this.rooms.get(state.room.key) === state) {
      this.rooms.delete(state.room.key);
      state.room.destroy();
    }
  }

  /** The people in a page's room right now; for tests and diagnostics. */
  peersIn(workspaceId: string, documentId: string): number {
    return this.rooms.get(`${workspaceId}:${documentId}`)?.room.size ?? 0;
  }

  private room(session: LiveSession, content: string, live: { state: Uint8Array; lineage: string } | null): Promise<RoomState> {
    const key = `${session.workspaceId}:${session.documentId}`;
    const existing = this.rooms.get(key);
    if (existing) return Promise.resolve(existing);
    const created: RoomState = {
      workspaceId: session.workspaceId,
      documentId: session.documentId,
      timer: null,
      firstPendingAt: null,
      saving: null,
      sessions: new Map(),
      room: undefined as unknown as LiveDocRoom,
    };
    created.room = new LiveDocRoom(key, content, live, () => this.changed(created));
    this.rooms.set(key, created);
    return Promise.resolve(created);
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
    if (!state.room.dirty) return;
    state.saving = this.persist(state).finally(() => {
      state.saving = null;
    });
    await state.saving;
  }

  private async persist(state: RoomState): Promise<void> {
    const { room } = state;
    const editor = room.lastEditor;
    const session = editor ? state.sessions.get(editor) : undefined;
    const content = room.text;
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
    for (const state of this.rooms.values()) state.room.destroy();
    this.rooms.clear();
  }
}
