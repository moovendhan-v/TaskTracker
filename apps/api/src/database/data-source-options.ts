import type { DataSourceOptions } from 'typeorm';
import type { Env } from '../config/env.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

export function buildDataSourceOptions(env: Env): DataSourceOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    migrationsRun: false,
    logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    extra: { max: 10, statement_timeout: 10_000 },
  };
}
