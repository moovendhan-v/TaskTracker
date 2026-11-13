import { Readable } from 'node:stream';
import { Logger } from '@nestjs/common';
import sharp from 'sharp';
import type { FileScanner } from '../scanning/file-scanner.port.js';
import { detectFileType, SNIFF_BYTES, type DetectedType } from './file-types.js';
import type { FileStorage } from './file-storage.port.js';
import type { StorageTokens } from './storage-tokens.js';

export const UPLOAD_LINK_TTL_MS = 10 * 60_000;
export const DOWNLOAD_LINK_TTL_MS = 10 * 60_000;

export type UploadCheck = (DetectedType & { size: number; thumbnail: boolean }) | 'missing' | 'refused' | 'infected' | 'unscanned';

/** Why a checked upload was refused, in words for the person who added it. */
export const UPLOAD_REFUSALS: Record<'refused' | 'infected' | 'unscanned', string> = {
  refused: "This file's contents don't match an allowed type",
  infected: 'This file looks harmful (the virus scan flagged it), so it wasn’t added',
  unscanned: 'This file couldn’t be checked for viruses right now; try again in a moment',
};

const logger = new Logger('UploadChecks');

/**
 * What actually arrived for an upload, before anyone else can download it:
 * - its size (no more than declared) and real type from the first bytes ('refused' otherwise);
 * - a malware scan of the whole file ('infected', or 'unscanned' when the scanner failed:
 *   refused either way, fail closed);
 * - for images, a small preview stored next to it (`<key>-thumb`).
 * 'missing' when nothing arrived yet.
 */
export async function inspectUpload(storage: FileStorage, scanner: FileScanner, key: string, declaredSize: number, fileName: string): Promise<UploadCheck> {
  const size = await storage.size(key);
  if (size === null) return 'missing';
  if (size <= 0 || size > declaredSize) return 'refused';
  const detected = detectFileType(await storage.head(key, SNIFF_BYTES), fileName);
  if (!detected) return 'refused';
  try {
    const result = await scanner.scan(await storage.read(key));
    if (!result.clean) {
      logger.warn(`Upload ${key} refused by the virus scan (${result.signature.slice(0, 100)})`);
      return 'infected';
    }
  } catch (error) {
    logger.error(`Upload ${key} couldn't be scanned: ${error instanceof Error ? error.message : 'unknown error'}`);
    return 'unscanned';
  }
  const thumbnail = THUMBNAIL_TYPES.has(detected.contentType) ? await makeThumbnail(storage, key) : false;
  return { ...detected, size, thumbnail };
}

/** Image types that get a preview. */
const THUMBNAIL_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
/** The preview fits in this box. */
export const THUMBNAIL_SIZE = 480;
/** Images larger than this many pixels aren't decoded (a small file can claim a huge image). */
const THUMBNAIL_MAX_PIXELS = 40_000_000;

export function thumbnailKey(key: string): string {
  return `${key}-thumb`;
}

/**
 * Makes a WebP preview of an image: turned upright, fitted in THUMBNAIL_SIZE, without its
 * metadata (EXIF location and the like isn't copied). An image that can't be decoded just
 * gets none; it was already checked to be the type it claims.
 */
async function makeThumbnail(storage: FileStorage, key: string): Promise<boolean> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of await storage.read(key)) chunks.push(chunk as Buffer);
    const preview = await sharp(Buffer.concat(chunks), { limitInputPixels: THUMBNAIL_MAX_PIXELS, animated: false, failOn: 'error' })
      .timeout({ seconds: 10 })
      .rotate()
      .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await storage.put(thumbnailKey(key), Readable.from([preview]), 'image/webp');
    return true;
  } catch (error) {
    logger.warn(`No preview for ${key}: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown error'}`);
    return false;
  }
}

/** Deletes a stored upload and its preview, if any. Never throws. */
export async function deleteUpload(storage: FileStorage, key: string): Promise<void> {
  await Promise.all([storage.delete(key).catch(() => undefined), storage.delete(thumbnailKey(key)).catch(() => undefined)]);
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
