import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { StatusesService } from './application/statuses.service.js';
import { TaskStatusRepository } from './domain/task-status.repository.js';
import { TypeOrmTaskStatusRepository } from './infrastructure/typeorm-task-status.repository.js';
import { StatusesResolver } from './presentation/graphql/statuses.resolver.js';

/** Custom task statuses per space. */
@Module({
  imports: [SpacesModule],
  providers: [StatusesService, StatusesResolver, { provide: TaskStatusRepository, useClass: TypeOrmTaskStatusRepository }],
  exports: [StatusesService],
})
export class StatusesModule {}
