import { Injectable } from '@nestjs/common';
import { TransactionalManager } from './transactional-manager.js';
import { UnitOfWork } from './unit-of-work.port.js';

@Injectable()
export class TypeOrmUnitOfWork extends UnitOfWork {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  /** Nested calls join the outer transaction instead of opening a new one. */
  run<T>(work: () => Promise<T>): Promise<T> {
    return this.transactional.inTransaction ? work() : this.transactional.runInTransaction(work);
  }
}
