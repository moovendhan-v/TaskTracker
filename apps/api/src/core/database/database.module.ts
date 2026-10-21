import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { buildDataSourceOptions } from './data-source-options.js';
import { DatabaseHealthIndicator } from './database-health.indicator.js';
import { pgPoolProvider, PG_POOL } from './pg-pool.provider.js';
import { TransactionalManager } from './transactional-manager.js';
import { TypeOrmUnitOfWork } from './typeorm-unit-of-work.js';
import { UnitOfWork } from './unit-of-work.port.js';

@Global()
@Module({
  imports: [TypeOrmModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => buildDataSourceOptions(env) })],
  providers: [
    TransactionalManager,
    { provide: UnitOfWork, useClass: TypeOrmUnitOfWork },
    DatabaseHealthIndicator,
    pgPoolProvider,
  ],
  exports: [TransactionalManager, UnitOfWork, DatabaseHealthIndicator, PG_POOL],
})
export class DatabaseModule {}
