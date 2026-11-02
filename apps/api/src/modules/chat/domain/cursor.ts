import type { MessagePosition } from './chat.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres timestamptz text, e.g. `2026-11-02 09:15:01.123456+00`. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/;

/** An opaque page cursor: the message's exact timestamp (microseconds) and id. */
export function encodeCursor(position: MessagePosition): string {
  return Buffer.from(`${position.at}|${position.id}`, 'utf8').toString('base64url');
}

/** The position in a cursor, or null when it isn't one of ours. */
export function decodeCursor(cursor: string): MessagePosition | null {
  if (cursor.length > 200) return null;
  const [at, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (rest.length || !at || !id || !TIMESTAMP.test(at) || !UUID.test(id)) return null;
  return { at, id };
}
