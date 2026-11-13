import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClamAvFileScanner, MockFileScanner } from './file-scanners.js';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe('MockFileScanner', () => {
  const scanner = new MockFileScanner();

  it('flags the EICAR test file, even split across chunks', async () => {
    expect(await scanner.scan(Readable.from([Buffer.from('hello'), Buffer.from(' world')]))).toEqual({ clean: true });
    expect(await scanner.scan(Readable.from([Buffer.from(`prefix ${EICAR} suffix`)]))).toEqual({ clean: false, signature: 'Eicar-Test-Signature' });
    const half = Math.floor(EICAR.length / 2);
    expect((await scanner.scan(Readable.from([Buffer.from(`x${EICAR.slice(0, half)}`), Buffer.from(EICAR.slice(half))]))).clean).toBe(false);
  });
});

/** A stand-in clamd: reads an INSTREAM and answers like ClamAV (or not at all, for the failure test). */
describe('ClamAvFileScanner', () => {
  let server: Server;
  let port: number;
  let mode: 'normal' | 'silent' = 'normal';
  const received: string[] = [];

  beforeAll(async () => {
    server = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let body = Buffer.alloc(0);
      let commandRead = false;
      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (!commandRead) {
          const end = buffer.indexOf(0);
          if (end < 0) return;
          received.push(buffer.subarray(0, end).toString());
          buffer = buffer.subarray(end + 1);
          commandRead = true;
        }
        for (;;) {
          if (buffer.length < 4) return;
          const size = buffer.readUInt32BE(0);
          if (size === 0) {
            if (mode === 'silent') return socket.end();
            socket.end(body.toString('latin1').includes(EICAR) ? 'stream: Win.Test.EICAR_HDB-1 FOUND\0' : 'stream: OK\0');
            return;
          }
          if (buffer.length < 4 + size) return;
          body = Buffer.concat([body, buffer.subarray(4, 4 + size)]);
          buffer = buffer.subarray(4 + size);
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('streams the file to clamd and reads its verdict', async () => {
    const scanner = new ClamAvFileScanner('127.0.0.1', port);
    expect(await scanner.scan(Readable.from([Buffer.alloc(200_000, 1), Buffer.from('clean')]))).toEqual({ clean: true });
    expect(await scanner.scan(Readable.from([Buffer.from(EICAR)]))).toEqual({ clean: false, signature: 'Win.Test.EICAR_HDB-1' });
    expect(received.at(-1)).toBe('zINSTREAM');
  });

  it('throws (so the file is refused) when clamd is down or answers oddly', async () => {
    mode = 'silent';
    await expect(new ClamAvFileScanner('127.0.0.1', port).scan(Readable.from([Buffer.from('x')]))).rejects.toThrow(/couldn’t check/);
    mode = 'normal';
    await expect(new ClamAvFileScanner('127.0.0.1', 1).scan(Readable.from([Buffer.from('x')]))).rejects.toThrow(/unavailable/);
  });
});
