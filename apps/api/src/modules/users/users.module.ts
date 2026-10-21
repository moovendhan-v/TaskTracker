import { Module } from '@nestjs/common';
import { UsersService } from './application/users.service.js';
import { UserRepository } from './domain/user.repository.js';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository.js';
import { MeController } from './presentation/me.controller.js';

@Module({
  controllers: [MeController],
  providers: [UsersService, { provide: UserRepository, useClass: TypeOrmUserRepository }],
  exports: [UsersService],
})
export class UsersModule {}
