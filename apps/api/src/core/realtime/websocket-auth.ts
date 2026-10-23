import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { SessionUser } from '../http/types/authenticated-request.js';

/** What a WebSocket connection carries after it was accepted. */
export interface SocketExtra {
  request: IncomingMessage;
  user?: SessionUser;
}

/**
 * Browsers attach cookies to cross-site WebSocket handshakes and CORS doesn't
 * apply to them, so the Origin header is checked explicitly against the same
 * allowlist (prevents cross-site WebSocket hijacking). A missing Origin is
 * refused too: every browser sends one.
 */
export function isAllowedOrigin(headers: IncomingHttpHeaders, allowed: readonly string[]): boolean {
  const origin = headers.origin;
  return typeof origin === 'string' && allowed.includes(origin);
}
