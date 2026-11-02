import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { FileStorage } from './file-storage.port.js';
import { LocalFileStorage } from './local-file-storage.js';
import { S3FileStorage } from './s3-file-storage.js';
import { StorageController } from './storage.controller.js';
import { StorageTokens } from './storage-tokens.js';

/** File storage, chosen by STORAGE_DRIVER: `local` (disk) or `s3` (AWS S3, Cloudflare R2, MinIO). */
@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: FileStorage,
      inject: [ENV],
      useFactory: (env: Env): FileStorage =>
        env.STORAGE_DRIVER === 's3'
          ? new S3FileStorage({
              bucket: env.S3_BUCKET!,
              region: env.S3_REGION,
              endpoint: env.S3_ENDPOINT,
              forcePathStyle: env.S3_FORCE_PATH_STYLE,
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            })
          : new LocalFileStorage(env.STORAGE_LOCAL_DIR),
    },
    { provide: StorageTokens, inject: [ENV], useFactory: (env: Env) => new StorageTokens(env.BETTER_AUTH_SECRET) },
  ],
  exports: [FileStorage, StorageTokens],
})
export class StorageModule {}
