import { Module } from '@nestjs/common';
// Registers the module's query resource (filters, sorting, resourceSchema).
import './infrastructure/task.query-resource.js';
import { TasksResolver } from './presentation/graphql/tasks.resolver.js';
import { ListsModule } from '../lists/lists.module.js';
import { MembersModule } from '../members/members.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { SprintsModule } from '../sprints/sprints.module.js';
import { TasksService } from './application/tasks.service.js';
import { TaskRepository } from './domain/task.repository.js';
import { TypeOrmTaskRepository } from './infrastructure/typeorm-task.repository.js';

@Module({
  imports: [ListsModule, MembersModule, SpacesModule, SprintsModule],
  providers: [TasksService, TasksResolver, { provide: TaskRepository, useClass: TypeOrmTaskRepository }],
  exports: [TasksService],
})
export class TasksModule {}
