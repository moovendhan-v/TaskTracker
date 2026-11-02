import { detectFileType, SNIFF_BYTES, type DetectedType } from './file-types.js';
import type { FileStorage } from './file-storage.port.js';
import type { StorageTokens } from './storage-tokens.js';

export const UPLOAD_LINK_TTL_MS = 10 * 60_000;
export const DOWNLOAD_LINK_TTL_MS = 10 * 60_000;

/**
 * What actually arrived for an upload: its size (no more than declared) and its
 * real type from the first bytes. Null when nothing arrived yet ('missing') or it
 * isn't an allowed kind of file ('refused').
 */
export async function inspectUpload(storage: FileStorage, key: string, declaredSize: number, fileName: string): Promise<(DetectedType & { size: number }) | 'missing' | 'refused'> {
  const size = await storage.size(key);
  if (size === null) return 'missing';
  if (size <= 0 || size > declaredSize) return 'refused';
  const detected = detectFileType(await storage.head(key, SNIFF_BYTES), fileName);
  return detected ? { ...detected, size } : 'refused';
}

/** A signed, short-lived same-origin link for putting the bytes of one upload. */
export function uploadUrl(tokens: StorageTokens, key: string, max: number): string {
  return `/api/storage/uploads/${tokens.sign({ op: 'put', key, max, exp: Date.now() + UPLOAD_LINK_TTL_MS })}`;
}

/** A signed, short-lived same-origin link to read a checked file. Images show inline; everything else downloads. */
export function downloadUrl(tokens: StorageTokens, key: string, contentType: string, fileName: string): string {
  const inline = contentType.startsWith('image/');
  return `/api/storage/files/${tokens.sign({ op: 'get', key, type: contentType, name: fileName, inline, exp: Date.now() + DOWNLOAD_LINK_TTL_MS })}`;
}
