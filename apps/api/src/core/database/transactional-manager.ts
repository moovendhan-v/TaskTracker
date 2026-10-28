import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { APPLY_SCOPE_SQL, toScopeSettings, type DataScope } from './data-scope.js';

interface TransactionContext {
  manager: EntityManager;
  scope: DataScope | null;
  /** True for a GraphQL query: nothing in it writes, so cached reads are safe. */
  readOnly: boolean;
}

export interface ScopeOptions {
  readOnly?: boolean;
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

  /** The current data scope, or null outside a scoped transaction. */
  get scope(): DataScope | null {
    return this.storage.getStore()?.scope ?? null;
  }

  /**
   * Whether a cached read may stand in for the database right now: outside a
   * transaction (guards) or inside a read-only one. A write must see its own
   * uncommitted changes, so it always reads from Postgres.
   */
  get cacheable(): boolean {
    const store = this.storage.getStore();
    return store === undefined || store.readOnly;
  }

  repository<T extends ObjectLiteral>(target: EntityTarget<T>): Repository<T> {
    return this.manager.getRepository(target);
  }

  /** Runs work in a transaction. Inside one already, the work joins it and keeps its scope. */
  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return work();
    return this.dataSource.transaction((manager) => this.storage.run({ manager, scope: null, readOnly: false }, work));
  }

  /**
   * Runs work inside a savepoint of the current transaction: if it throws, only
   * what it did is undone and the error is rethrown, so the caller can carry on.
   * Used for side work, such as automations, that must not sink the change
   * that triggered it.
   */
  async savepoint<T>(work: () => Promise<T>): Promise<T> {
    const current = this.storage.getStore();
    if (!current) throw new Error('savepoint() needs a transaction');
    const name = `sp_${(this.savepoints += 1)}`;
    await current.manager.query(`SAVEPOINT ${name}`);
    try {
      const result = await work();
      await current.manager.query(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      await current.manager.query(`ROLLBACK TO SAVEPOINT ${name}`);
      await current.manager.query(`RELEASE SAVEPOINT ${name}`);
      throw error;
    }
  }

  private savepoints = 0;

  /**
   * Runs work in a transaction limited to `scope`. Inside a transaction already,
   * it switches that transaction's scope for the duration of the work, then
   * switches back.
   */
  async runInScope<T>(scope: DataScope, work: () => Promise<T>, options: ScopeOptions = {}): Promise<T> {
    const current = this.storage.getStore();
    if (!current) {
      return this.dataSource.transaction(async (manager) => {
        await applyScope(manager, scope);
        return this.storage.run({ manager, scope, readOnly: options.readOnly ?? false }, work);
      });
    }

    await applyScope(current.manager, scope);
    try {
      const result = await this.storage.run({ manager: current.manager, scope, readOnly: current.readOnly }, work);
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
  await manager.query(APPLY_SCOPE_SQL, toScopeSettings(scope));
}
