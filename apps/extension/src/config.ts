import { ext } from './browser.js';

export interface Connection {
  /** The TaskFlow address, e.g. https://taskflow.example.com (no trailing slash). */
  server: string;
  token: string;
  expiresAt: string;
}

/** A connection being approved in TaskFlow: the PKCE verifier stays here, only its hash went out. */
export interface PendingConnection {
  server: string;
  verifier: string;
  startedAt: number;
}

const CONNECTION = 'connection';
const PENDING = 'pendingConnection';
const SERVER = 'lastServer';
export const PENDING_TTL_MS = 10 * 60_000;

export async function getConnection(): Promise<Connection | null> {
  const stored = (await ext.storage.local.get(CONNECTION))[CONNECTION] as Connection | undefined;
  if (!stored) return null;
  if (new Date(stored.expiresAt).getTime() <= Date.now()) {
    await ext.storage.local.remove(CONNECTION);
    return null;
  }
  return stored;
}

export const saveConnection = (connection: Connection) => ext.storage.local.set({ [CONNECTION]: connection, [SERVER]: connection.server });
export const clearConnection = () => ext.storage.local.remove(CONNECTION);

export async function getPending(): Promise<PendingConnection | null> {
  const pending = (await ext.storage.local.get(PENDING))[PENDING] as PendingConnection | undefined;
  if (!pending || Date.now() - pending.startedAt > PENDING_TTL_MS) return null;
  return pending;
}
export const savePending = (pending: PendingConnection) => ext.storage.local.set({ [PENDING]: pending, [SERVER]: pending.server });
export const clearPending = () => ext.storage.local.remove(PENDING);

export async function lastServer(): Promise<string> {
  return ((await ext.storage.local.get(SERVER))[SERVER] as string | undefined) ?? '';
}

/**
 * The TaskFlow address as an origin. HTTPS only, except plain http on this computer (local
 * development), so a token is never sent in the clear.
 */
export function normalizeServer(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}
