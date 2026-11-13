import { Readable } from 'node:stream';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FileScanner, type ScanResult } from '../scanning/file-scanner.port.js';
import { MockFileScanner } from '../scanning/file-scanners.js';
import { FileStorage } from './file-storage.port.js';
import { deleteUpload, inspectUpload, thumbnailKey } from './upload-checks.js';

class MemoryStorage extends FileStorage {
  readonly files = new Map<string, { body: Buffer; type: string }>();
  async put(key: string, body: Readable, contentType: string): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(chunk as Buffer);
    this.files.set(key, { body: Buffer.concat(chunks), type: contentType });
  }
  async size(key: string): Promise<number | null> {
    return this.files.get(key)?.body.length ?? null;
  }
  async head(key: string, bytes: number): Promise<Buffer> {
    return this.files.get(key)!.body.subarray(0, bytes);
  }
  async read(key: string): Promise<Readable> {
    return Readable.from([this.files.get(key)!.body]);
  }
  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

class BrokenScanner extends FileScanner {
  readonly name = 'clamav';
  scan(): Promise<ScanResult> {
    return Promise.reject(new Error('down'));
  }
}

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

async function stored(storage: MemoryStorage, key: string, body: Buffer): Promise<void> {
  await storage.put(key, Readable.from([body]), 'application/octet-stream');
}

describe('inspectUpload', () => {
  const scanner = new MockFileScanner();

  it('makes an upright WebP preview of an image, without its metadata', async () => {
    const storage = new MemoryStorage();
    const photo = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#3366cc' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret location' } } })
      .toBuffer();
    await stored(storage, 'w/a/chat/photo', photo);
    const checked = await inspectUpload(storage, scanner, 'w/a/chat/photo', photo.length, 'photo.jpg');
    expect(checked).toMatchObject({ contentType: 'image/jpeg', size: photo.length, thumbnail: true });
    const preview = storage.files.get(thumbnailKey('w/a/chat/photo'))!;
    expect(preview.type).toBe('image/webp');
    const meta = await sharp(preview.body).metadata();
    expect([meta.format, meta.width, meta.height, meta.exif]).toEqual(['webp', 480, 240, undefined]);
  });

  it('keeps an image it can’t decode, without a preview', async () => {
    const storage = new MemoryStorage();
    // PNG's signature, then nothing an image decoder can use.
    const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
    await stored(storage, 'w/a/chat/broken', broken);
    expect(await inspectUpload(storage, scanner, 'w/a/chat/broken', broken.length, 'broken.png')).toMatchObject({ contentType: 'image/png', thumbnail: false });
  });

  it('refuses a file the scan flags, or one it couldn’t scan', async () => {
    const storage = new MemoryStorage();
    const body = Buffer.from(`notes\n${EICAR}\n`);
    await stored(storage, 'w/a/chat/notes', body);
    expect(await inspectUpload(storage, scanner, 'w/a/chat/notes', body.length, 'notes.txt')).toBe('infected');
    const clean = Buffer.from('just notes\n');
    await stored(storage, 'w/a/chat/clean', clean);
    expect(await inspectUpload(storage, new BrokenScanner(), 'w/a/chat/clean', clean.length, 'notes.txt')).toBe('unscanned');
    expect(await inspectUpload(storage, scanner, 'w/a/chat/clean', clean.length, 'notes.txt')).toMatchObject({ contentType: 'text/plain; charset=utf-8', thumbnail: false });
  });

  it('deletes a file with its preview', async () => {
    const storage = new MemoryStorage();
    await stored(storage, 'w/a/chat/x', Buffer.from('a'));
    await stored(storage, thumbnailKey('w/a/chat/x'), Buffer.from('b'));
    await deleteUpload(storage, 'w/a/chat/x');
    expect(storage.files.size).toBe(0);
  });
});
