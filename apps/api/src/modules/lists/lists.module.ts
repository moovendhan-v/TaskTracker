import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { ListsService } from './application/lists.service.js';
import { TaskListRepository } from './domain/task-list.repository.js';
import { TypeOrmTaskListRepository } from './infrastructure/typeorm-task-list.repository.js';
import { ListsController } from './presentation/lists.controller.js';

@Module({
  imports: [SpacesModule],
  controllers: [ListsController],
  providers: [ListsService, { provide: TaskListRepository, useClass: TypeOrmTaskListRepository }],
  exports: [ListsService],
})
export class ListsModule {}
