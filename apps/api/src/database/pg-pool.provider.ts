import { Pool } from 'pg';
import type { Provider } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

export const PG_POOL = Symbol('PG_POOL');

/** Connection pool used by Better Auth. TypeORM keeps its own pool. */
export const pgPoolProvider: Provider = {
  provide: PG_POOL,
  inject: [ENV],
  useFactory: (env: Env): Pool =>
    new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
      max: 5,
    }),
};
