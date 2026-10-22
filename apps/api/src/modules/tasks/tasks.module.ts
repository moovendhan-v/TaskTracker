import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { MembersModule } from '../members/members.module.js';
import { TasksService } from './application/tasks.service.js';
import { TaskRepository } from './domain/task.repository.js';
import { TypeOrmTaskRepository } from './infrastructure/typeorm-task.repository.js';
import { TasksController } from './presentation/tasks.controller.js';

@Module({
  imports: [ListsModule, MembersModule],
  controllers: [TasksController],
  providers: [TasksService, { provide: TaskRepository, useClass: TypeOrmTaskRepository }],
  exports: [TasksService],
})
export class TasksModule {}
