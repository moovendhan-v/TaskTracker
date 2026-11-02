import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { assertStorageKey, FileStorage } from './file-storage.port.js';

/** Files on the API's own disk. For development and tests; one API instance only. */
export class LocalFileStorage extends FileStorage {
  private readonly root: string;

  constructor(directory: string) {
    super();
    this.root = resolve(directory);
  }

  private path(key: string): string {
    assertStorageKey(key);
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + '/')) throw new Error('Invalid storage key');
    return path;
  }

  async put(key: string, body: Readable, _contentType: string): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await pipeline(body, createWriteStream(path));
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.path(key))).size;
    } catch {
      return null;
    }
  }

  async head(key: string, bytes: number): Promise<Buffer> {
    const handle = await open(this.path(key), 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async read(key: string): Promise<Readable> {
    return createReadStream(this.path(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
