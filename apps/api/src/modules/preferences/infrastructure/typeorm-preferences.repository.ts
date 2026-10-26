import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { PreferencesRepository } from '../domain/preferences.repository.js';
import { UserPreferenceOrmEntity } from './user-preference.orm-entity.js';

/** Runs in the user's own scope; row-level security limits it to their row. */
@Injectable()
export class TypeOrmPreferencesRepository extends PreferencesRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async find(userId: string): Promise<unknown> {
    const row = await this.transactional.repository(UserPreferenceOrmEntity).findOneBy({ userId });
    return row?.data ?? null;
  }

  async save(userId: string, data: object): Promise<void> {
    await this.transactional.repository(UserPreferenceOrmEntity).upsert({ userId, data }, ['userId']);
  }
}
