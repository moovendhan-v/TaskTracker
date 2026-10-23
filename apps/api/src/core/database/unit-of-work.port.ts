import type { DataScope } from './data-scope.js';

/** Runs work atomically. Repositories called inside `run` share the same transaction. */
export abstract class UnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>;

  /**
   * Runs work in a transaction whose row-level security scope is `scope`. Used
   * where an operation crosses into a different scope on purpose, e.g. when a
   * new workspace's rows are written.
   */
  abstract runInScope<T>(scope: DataScope, work: () => Promise<T>): Promise<T>;
}
