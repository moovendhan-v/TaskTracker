import type { Readable } from 'node:stream';

export type ScanResult = { clean: true } | { clean: false; signature: string };

/**
 * Checks uploaded files for malware before anyone else can download them. Chosen by
 * FILE_SCANNER: `clamav` (a clamd server), `mock` (development and tests: flags the EICAR
 * test file only) or `none`. Production must choose clamav or none explicitly.
 */
export abstract class FileScanner {
  abstract readonly name: 'clamav' | 'mock' | 'none';
  /** Throws when the file couldn't be scanned; callers refuse the file then (fail closed). */
  abstract scan(body: Readable): Promise<ScanResult>;
}
