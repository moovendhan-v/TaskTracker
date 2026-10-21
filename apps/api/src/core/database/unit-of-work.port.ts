/** Runs work atomically. Repositories called inside `run` share the same transaction. */
export abstract class UnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
