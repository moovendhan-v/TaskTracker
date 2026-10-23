import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';
import { UserOrmEntity } from './user.orm-entity.js';

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  findById(id: string): Promise<User | null> {
    return this.transactional.repository(UserOrmEntity).findOneBy({ id });
  }

  findVerifiedByEmail(email: string): Promise<User | null> {
    return this.transactional
      .repository(UserOrmEntity)
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .andWhere('user.emailVerified = true')
      .getOne();
  }
}
