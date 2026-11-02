import type { Readable } from 'node:stream';

/**
 * Where uploaded files live. Keys are opaque, server-made paths such as
 * `w/<workspace>/chat/<uuid>`; nothing a user typed ever becomes part of one.
 * Implementations: local disk (development, tests) and S3-compatible storage
 * (AWS S3, Cloudflare R2, MinIO).
 */
export abstract class FileStorage {
  /** Stores the whole stream under `key`, replacing anything there. */
  abstract put(key: string, body: Readable, contentType: string): Promise<void>;
  /** The object's size in bytes, or null when there is none. */
  abstract size(key: string): Promise<number | null>;
  /** The first `bytes` bytes, e.g. to check what a file really is. */
  abstract head(key: string, bytes: number): Promise<Buffer>;
  abstract read(key: string): Promise<Readable>;
  /** Removes the object; missing objects are fine. */
  abstract delete(key: string): Promise<void>;
}

/** Server-made keys only: lowercase letters, digits, `-` and `/`, no `..`. */
const KEY = /^[a-z0-9][a-z0-9/-]{0,200}$/;

export function assertStorageKey(key: string): void {
  if (!KEY.test(key) || key.includes('//') || key.split('/').some((part) => part === '' || part === '..' || part === '.')) {
    throw new Error('Invalid storage key');
  }
}
