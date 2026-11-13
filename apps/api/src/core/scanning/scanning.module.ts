import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { FileScanner } from './file-scanner.port.js';
import { ClamAvFileScanner, MockFileScanner, NoFileScanner } from './file-scanners.js';

/** The malware scanner for uploads (FILE_SCANNER). */
@Global()
@Module({
  providers: [
    {
      provide: FileScanner,
      inject: [ENV],
      useFactory: (env: Env): FileScanner =>
        env.FILE_SCANNER === 'clamav' ? new ClamAvFileScanner(env.CLAMAV_HOST!, env.CLAMAV_PORT) : env.FILE_SCANNER === 'none' ? new NoFileScanner() : new MockFileScanner(),
    },
  ],
  exports: [FileScanner],
})
export class ScanningModule {}
