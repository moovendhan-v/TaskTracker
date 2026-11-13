import { connect } from 'node:net';
import type { Readable } from 'node:stream';
import { FileScanner, type ScanResult } from './file-scanner.port.js';

/** A scan gives up after this long (a 10 MB file takes well under a second). */
const SCAN_TIMEOUT_MS = 30_000;
/** clamd answers in one short line. */
const MAX_REPLY_BYTES = 4096;

/** No scanning (chosen explicitly). */
export class NoFileScanner extends FileScanner {
  readonly name = 'none';

  async scan(body: Readable): Promise<ScanResult> {
    body.resume();
    return { clean: true };
  }
}

/** The EICAR antivirus test file's signature (a harmless string every scanner flags). */
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/**
 * For development and tests: behaves like a scanner without one, flagging only the EICAR test
 * file, so the whole "infected file" path can be tried. Never allowed in production.
 */
export class MockFileScanner extends FileScanner {
  readonly name = 'mock';

  async scan(body: Readable): Promise<ScanResult> {
    let tail = '';
    for await (const chunk of body) {
      // Keep enough of the previous chunk that a signature split across chunks is still found.
      const text = tail + (chunk as Buffer).toString('latin1');
      if (text.includes(EICAR)) {
        body.destroy();
        return { clean: false, signature: 'Eicar-Test-Signature' };
      }
      tail = text.slice(-EICAR.length);
    }
    return { clean: true };
  }
}

/**
 * ClamAV's clamd over TCP (INSTREAM): the file goes in length-prefixed chunks, and clamd
 * answers "stream: OK" or "stream: <signature> FOUND". Anything else (an error, a timeout,
 * a size limit hit) throws, so the file is refused.
 */
export class ClamAvFileScanner extends FileScanner {
  readonly name = 'clamav';

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {
    super();
  }

  scan(body: Readable): Promise<ScanResult> {
    return new Promise<ScanResult>((resolve, reject) => {
      const socket = connect({ host: this.host, port: this.port });
      let reply = '';
      let settled = false;
      const finish = (error: Error | null, result?: ScanResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        body.destroy();
        if (error) reject(error);
        else resolve(result!);
      };
      const timer = setTimeout(() => finish(new Error('The virus scan timed out')), SCAN_TIMEOUT_MS);
      socket.on('error', () => finish(new Error('The virus scanner is unavailable')));
      socket.on('data', (chunk: Buffer) => {
        reply += chunk.toString('utf8');
        if (reply.length > MAX_REPLY_BYTES) finish(new Error('The virus scanner sent an unexpected answer'));
      });
      socket.on('end', () => {
        const line = reply.replace(/\0/g, '').trim();
        if (/^stream: OK$/.test(line)) return finish(null, { clean: true });
        const found = /^stream: (.{1,200}) FOUND$/.exec(line);
        if (found) return finish(null, { clean: false, signature: found[1]! });
        finish(new Error('The virus scanner couldn’t check the file'));
      });
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        body.on('data', (chunk: Buffer) => {
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          if (!socket.write(Buffer.concat([size, chunk]))) body.pause();
        });
        socket.on('drain', () => body.resume());
        body.on('end', () => socket.end(Buffer.alloc(4)));
        body.on('error', () => finish(new Error('The file couldn’t be read for scanning')));
      });
    });
  }
}
