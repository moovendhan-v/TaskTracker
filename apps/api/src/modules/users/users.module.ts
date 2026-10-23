import { Module } from '@nestjs/common';
import { UsersService } from './application/users.service.js';
import { UserRepository } from './domain/user.repository.js';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository.js';
import { MeResolver } from './presentation/graphql/me.resolver.js';

@Module({
  providers: [UsersService, MeResolver, { provide: UserRepository, useClass: TypeOrmUserRepository }],
  exports: [UsersService],
})
export class UsersModule {}
