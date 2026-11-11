import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer, type WebSocket } from 'ws';
import { LIVE_DOCS_PATH } from '../../../../bootstrap/api-prefix.js';
import { ENV } from '../../../../config/config.module.js';
import type { Env } from '../../../../config/env.schema.js';
import { AuthService } from '../../../../core/auth/auth.service.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { isAllowedOrigin } from '../../../../core/realtime/websocket-auth.js';
import { LiveDocsService, type LiveSession } from '../../application/live-docs.service.js';
import { encodeNotice, type LivePeer } from '../../application/live-doc-room.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** One message (a Yjs update) at most this big; typing sends a few bytes. */
const MAX_MESSAGE_BYTES = 512 * 1024;
/** Messages per connection per second, averaged over a few seconds. */
const MESSAGES_PER_SECOND = 60;
/** How often an open connection's session and access are checked again. */
const RECHECK_MS = 60_000;
/** Connection attempts per address per minute: upgrades skip the HTTP rate limiter. */
const UPGRADES_PER_MINUTE = 30;

/**
 * WebSocket for live page editing (C5) at /api/docs/live?workspaceId=…&documentId=….
 * Like the GraphQL socket it needs an allowed Origin (no cross-site hijacking) and a
 * valid session; then workspace membership and doc.view in the page's space. Editing
 * also needs edit rights on the page; readers watch changes as they happen. Sessions and
 * access are checked again every minute, so signing out or losing access closes it.
 */
@Injectable()
export class LiveDocsGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LiveDocsGateway.name);
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  private server: Server | null = null;
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly adapterHost: HttpAdapterHost,
    private readonly authService: AuthService,
    private readonly live: LiveDocsService,
  ) {}

  onApplicationBootstrap(): void {
    this.server = this.adapterHost.httpAdapter?.getHttpServer() as Server | undefined ?? null;
    this.server?.on('upgrade', this.onUpgrade);
  }

  onModuleDestroy(): void {
    this.server?.off('upgrade', this.onUpgrade);
    for (const client of this.wss.clients) client.close(1001, 'Server is restarting');
    this.wss.close();
  }

  private readonly onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== LIVE_DOCS_PATH) return;
    void this.accept(request, socket, head, url).catch((error: unknown) => {
      this.logger.error('Live docs upgrade failed', error instanceof Error ? error.stack : String(error));
      refuse(socket, 500);
    });
  };

  private async accept(request: IncomingMessage, socket: Duplex, head: Buffer, url: URL): Promise<void> {
    if (!this.allowAttempt(request)) return refuse(socket, 429);
    if (!isAllowedOrigin(request.headers, this.env.CORS_ORIGINS)) return refuse(socket, 403);
    const workspaceId = url.searchParams.get('workspaceId') ?? '';
    const documentId = url.searchParams.get('documentId') ?? '';
    if (!UUID.test(workspaceId) || !UUID.test(documentId)) return refuse(socket, 400);
    const user = await this.authService.getSessionUser(request.headers).catch(() => null);
    if (!user) return refuse(socket, 401);
    const session: LiveSession = { user, workspaceId, documentId };

    let opened: Awaited<ReturnType<LiveDocsService['authorize']>>;
    try {
      opened = await this.live.authorize(session);
    } catch (error) {
      // Not found and forbidden look the same, so nobody learns a page exists.
      if (error instanceof DomainError) return refuse(socket, error.kind === 'invalid' ? 400 : 404);
      throw error;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => void this.connected(ws, request, session, opened));
  }

  /** A fixed window per client address (the proxy's X-Forwarded-For when it is trusted). */
  private allowAttempt(request: IncomingMessage): boolean {
    const forwarded = this.env.TRUST_PROXY > 0 ? String(request.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() : '';
    const address = forwarded || request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (this.attempts.size > 10_000) for (const [key, entry] of this.attempts) if (entry.resetAt <= now) this.attempts.delete(key);
    const entry = this.attempts.get(address);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(address, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    entry.count++;
    return entry.count <= UPGRADES_PER_MINUTE;
  }

  private async connected(ws: WebSocket, request: IncomingMessage, session: LiveSession, opened: Awaited<ReturnType<LiveDocsService['authorize']>>): Promise<void> {
    const { content, canEdit, live } = opened;
    ws.binaryType = 'nodebuffer';
    const peer: LivePeer = {
      userId: session.user.id,
      userName: session.user.name,
      canEdit,
      send: (message) => {
        if (ws.readyState === ws.OPEN) ws.send(message, { binary: true });
      },
      close: (code, reason) => ws.close(code, reason.slice(0, 120)),
    };
    // Messages that arrive while the room opens (it may ask other instances first) wait their turn.
    let state: Awaited<ReturnType<LiveDocsService['join']>> | null = null;
    const early: Uint8Array[] = [];
    const deliver = (message: Uint8Array) => {
      try {
        state!.room.receive(peer, message);
      } catch {
        ws.close(4400, 'Malformed message');
      }
    };

    // A small token bucket per connection.
    let tokens = MESSAGES_PER_SECOND * 3;
    let refilled = Date.now();
    ws.on('message', (data: Buffer, isBinary: boolean) => {
      const now = Date.now();
      tokens = Math.min(MESSAGES_PER_SECOND * 3, tokens + ((now - refilled) / 1000) * MESSAGES_PER_SECOND);
      refilled = now;
      if (--tokens < 0) return ws.close(4429, 'Too many changes at once');
      if (!isBinary) return ws.close(4400, 'Binary messages only');
      const message = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      if (state) deliver(message);
      else if (early.push(message) > EARLY_MESSAGES_MAX) ws.close(4429, 'Too many changes at once');
    });

    try {
      state = await this.live.join(session, peer, content, live);
    } catch (error) {
      ws.close(4429, error instanceof DomainError ? error.message.slice(0, 120) : 'Could not open the page');
      return;
    }
    // Closed while the room was opening: leave at once.
    if (ws.readyState !== ws.OPEN) {
      void this.live.leave(state, peer);
      return;
    }
    for (const message of early.splice(0)) deliver(message);
    const joined = state;

    // Signed out, suspended, removed or no longer allowed: the socket closes. Edit rights follow role changes.
    const recheck = setInterval(() => {
      void (async () => {
        const user = await this.authService.getSessionUser(request.headers).catch(() => null);
        if (!user) return ws.close(4401, 'Your session ended');
        try {
          const now = await this.live.authorize({ ...session, user });
          if (now.canEdit !== peer.canEdit) {
            peer.canEdit = now.canEdit;
            if (!now.canEdit) peer.send(encodeNotice({ type: 'read-only' }));
          }
        } catch {
          ws.close(4403, 'You no longer have access to this page');
        }
      })();
    }, RECHECK_MS);
    recheck.unref();
    ws.once('close', () => {
      clearInterval(recheck);
      void this.live.leave(joined, peer);
    });
  }
}

/** Messages kept while a room opens; a browser sends two or three. */
const EARLY_MESSAGES_MAX = 16;

function refuse(socket: Duplex, status: number): void {
  const text = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 429: 'Too Many Requests', 500: 'Internal Server Error' }[status] ?? 'Error';
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}
