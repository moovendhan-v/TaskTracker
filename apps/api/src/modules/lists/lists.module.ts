import { Module } from '@nestjs/common';
import { ListsResolver } from './presentation/graphql/lists.resolver.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { ListsService } from './application/lists.service.js';
import { TaskListRepository } from './domain/task-list.repository.js';
import { TypeOrmTaskListRepository } from './infrastructure/typeorm-task-list.repository.js';

@Module({
  imports: [SpacesModule],
  providers: [ListsService, ListsResolver, { provide: TaskListRepository, useClass: TypeOrmTaskListRepository }],
  exports: [ListsService],
})
export class ListsModule {}
