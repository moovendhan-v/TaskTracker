import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { APPLY_SCOPE_SQL, toScopeSettings, type DataScope } from './data-scope.js';

interface TransactionContext {
  manager: EntityManager;
  scope: DataScope | null;
}

/**
 * Hands repositories the EntityManager of the current transaction, or the
 * default manager outside one. Lets services stay free of TypeORM.
 *
 * Tenant tables have row-level security, so useful queries run inside
 * `runInScope`. Outside a scoped transaction they see no tenant rows.
 */
@Injectable()
export class TransactionalManager {
  private readonly storage = new AsyncLocalStorage<TransactionContext>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  get manager(): EntityManager {
    return this.storage.getStore()?.manager ?? this.dataSource.manager;
  }

  get inTransaction(): boolean {
    return this.storage.getStore() !== undefined;
  }

  repository<T extends ObjectLiteral>(target: EntityTarget<T>): Repository<T> {
    return this.manager.getRepository(target);
  }

  /** Runs work in a transaction. Inside one already, the work joins it and keeps its scope. */
  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return work();
    return this.dataSource.transaction((manager) => this.storage.run({ manager, scope: null }, work));
  }

  /**
   * Runs work in a transaction limited to `scope`. Inside a transaction already,
   * it switches that transaction's scope for the duration of the work, then
   * switches back.
   */
  async runInScope<T>(scope: DataScope, work: () => Promise<T>): Promise<T> {
    const current = this.storage.getStore();
    if (!current) {
      return this.dataSource.transaction(async (manager) => {
        await applyScope(manager, scope);
        return this.storage.run({ manager, scope }, work);
      });
    }

    await applyScope(current.manager, scope);
    try {
      const result = await this.storage.run({ manager: current.manager, scope }, work);
      await applyScope(current.manager, current.scope);
      return result;
    } catch (error) {
      // Restore the outer scope in case the caller catches the error and keeps using the
      // transaction. If the transaction itself failed, Postgres rejects this and every later
      // query anyway, so that rejection is ignored and the original error is rethrown.
      await applyScope(current.manager, current.scope).catch(() => undefined);
      throw error;
    }
  }
}

async function applyScope(manager: EntityManager, scope: DataScope | null): Promise<void> {
  await manager.query(APPLY_SCOPE_SQL, scope ? toScopeSettings(scope) : ['', '', '']);
}
