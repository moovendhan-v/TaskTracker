import type { BugResponse, ExtensionSessionResponse, ReportBugRequest, SimilarBugResponse, TaskUploadResult, TaskUploadTicket } from '@taskflow/shared-types';
import { clearConnection, getConnection, type Connection } from './config.js';

export class NotConnectedError extends Error {
  constructor() {
    super('Not connected to TaskFlow');
  }
}

const TIMEOUT_MS = 20_000;

async function request<T>(connection: Pick<Connection, 'server'> & { token?: string }, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${connection.server}/api/extension/${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', ...(connection.token ? { Authorization: `Bearer ${connection.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'omit',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401) {
    // Revoked, expired, or removed from the workspace: forget the token.
    if (connection.token) await clearConnection();
    throw new NotConnectedError();
  }
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) throw new Error((body as { message?: string } | null)?.message ?? `TaskFlow answered ${response.status}`);
  return body as T;
}

async function connected(): Promise<Connection> {
  const connection = await getConnection();
  if (!connection) throw new NotConnectedError();
  return connection;
}

export const api = {
  exchange: (server: string, verifier: string) => request<{ status: 'pending' } | { status: 'connected'; token: string; expiresAt: string }>({ server }, 'token', { body: { verifier } }),
  session: async () => request<ExtensionSessionResponse>(await connected(), 'session'),
  similar: async (spaceId: string, title: string) => request<SimilarBugResponse[]>(await connected(), `bugs/similar?spaceId=${encodeURIComponent(spaceId)}&title=${encodeURIComponent(title)}`),
  report: async (input: Omit<ReportBugRequest, 'capture'> & { captureJson: string | null }) => request<BugResponse & { url: string }>(await connected(), 'bugs', { body: input }),
  disconnect: async () => {
    const connection = await getConnection();
    if (connection) await request(connection, 'disconnect', { body: {} }).catch(() => undefined);
    await clearConnection();
  },
  /** Ask for a link, PUT the bytes, let TaskFlow check them (type by content, size). */
  async upload(taskId: string, file: Blob, fileName: string): Promise<TaskUploadResult> {
    const connection = await connected();
    const ticket = await request<TaskUploadTicket>(connection, `bugs/${taskId}/uploads`, { body: { fileName, size: file.size } });
    const put = await fetch(`${connection.server}${ticket.uploadUrl}`, { method: 'PUT', body: file, credentials: 'omit' });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return request<TaskUploadResult>(connection, `uploads/${ticket.attachmentId}/complete`, { body: {} });
  },
};
