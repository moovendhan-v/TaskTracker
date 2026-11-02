import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { assertStorageKey } from './file-storage.port.js';
import { cleanFileName, detectFileType, isAllowedExtension } from './file-types.js';
import { LocalFileStorage } from './local-file-storage.js';
import { StorageTokens } from './storage-tokens.js';

const bytes = (...values: (number | string)[]) => Buffer.concat(values.map((value) => (typeof value === 'string' ? Buffer.from(value, 'latin1') : Buffer.from([value]))));

describe('storage tokens', () => {
  const tokens = new StorageTokens('a'.repeat(40));
  const grant = { op: 'get' as const, key: 'w/1/chat/a', type: 'image/png', name: 'a.png', inline: true, exp: Date.now() + 60_000 };

  it('round-trips a grant', () => {
    expect(tokens.verify(tokens.sign(grant))).toEqual(grant);
  });

  it('refuses altered, expired, foreign and malformed tokens', () => {
    const token = tokens.sign(grant);
    const [payload, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...grant, key: 'w/2/chat/b' })).toString('base64url');
    expect(tokens.verify(`${forged}.${mac}`)).toBeNull();
    expect(tokens.verify(`${payload}.${mac}x`)).toBeNull();
    expect(tokens.verify(tokens.sign({ ...grant, exp: Date.now() - 1 }))).toBeNull();
    expect(new StorageTokens('b'.repeat(40)).verify(token)).toBeNull();
    expect(tokens.verify('nope')).toBeNull();
    expect(tokens.verify('a'.repeat(3000))).toBeNull();
  });
});

describe('file types', () => {
  it('trusts the content, not the name', () => {
    const png = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 'rest');
    expect(detectFileType(png, 'shot.png')).toEqual({ contentType: 'image/png', inline: true });
    expect(detectFileType(png, 'shot.jpg')).toBeNull();
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0), 'photo.JPEG')).toEqual({ contentType: 'image/jpeg', inline: true });
    expect(detectFileType(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), 'a.webp')?.contentType).toBe('image/webp');
    expect(detectFileType(bytes('%PDF-1.7'), 'spec.pdf')).toEqual({ contentType: 'application/pdf', inline: false });
    expect(detectFileType(bytes('PK', 3, 4, 'x'), 'plan.docx')?.contentType).toContain('wordprocessingml');
    expect(detectFileType(Buffer.from('a,b\n1,2\n'), 'data.csv')).toEqual({ contentType: 'text/csv; charset=utf-8', inline: false });
    expect(detectFileType(Buffer.from('café ☕'), 'notes.txt')?.contentType).toBe('text/plain; charset=utf-8');
  });

  it('refuses HTML, SVG, executables and disguised files', () => {
    expect(detectFileType(Buffer.from('<html><script>alert(1)</script>'), 'page.html')).toBeNull();
    expect(detectFileType(Buffer.from('<svg onload=alert(1)>'), 'logo.svg')).toBeNull();
    expect(detectFileType(Buffer.from('<svg onload=alert(1)>'), 'logo.png')).toBeNull();
    expect(detectFileType(bytes('MZ', 0x90, 0), 'setup.exe')).toBeNull();
    expect(detectFileType(bytes('MZ', 0x90, 0), 'readme.txt')).toBeNull();
    expect(detectFileType(Buffer.alloc(0), 'empty.txt')).toBeNull();
    expect(isAllowedExtension('a.svg')).toBe(false);
    expect(isAllowedExtension('a.PNG')).toBe(true);
  });

  it('cleans file names', () => {
    expect(cleanFileName('../../etc/passwd')).toBe('passwd');
    expect(cleanFileName('C:\\Users\\me\\"report".pdf')).toBe('report.pdf');
    expect(cleanFileName('\u0000\u001f')).toBe('file');
  });
});

describe('local storage', () => {
  let dir = '';
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('stores, reads, measures and deletes, and only under its own directory', async () => {
    dir = await mkdtemp(join(tmpdir(), 'taskflow-storage-'));
    const storage = new LocalFileStorage(dir);
    await storage.put('w/1/chat/abc', Readable.from([Buffer.from('hello world')]), 'text/plain');
    expect(await storage.size('w/1/chat/abc')).toBe(11);
    expect((await storage.head('w/1/chat/abc', 5)).toString()).toBe('hello');
    await storage.delete('w/1/chat/abc');
    expect(await storage.size('w/1/chat/abc')).toBeNull();
    for (const key of ['../escape', 'w/../../x', '/abs', 'W/Upper', 'a//b', 'a/./b']) expect(() => assertStorageKey(key)).toThrow();
    await expect(storage.put('../escape', Readable.from([]), 'x')).rejects.toThrow();
  });
});
