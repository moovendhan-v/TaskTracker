import { Module } from '@nestjs/common';
// Registers the module's query resource (filters, sorting, resourceSchema).
import './infrastructure/task.query-resource.js';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module.js';
import { ListsModule } from '../lists/lists.module.js';
import { MembersModule } from '../members/members.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { SprintsModule } from '../sprints/sprints.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { TasksService } from './application/tasks.service.js';
import { TaskActivityRepository, TaskRelationRepository, TaskWatcherRepository } from './domain/task-extras.repository.js';
import { TaskRepository } from './domain/task.repository.js';
import { TypeOrmTaskActivityRepository, TypeOrmTaskRelationRepository, TypeOrmTaskWatcherRepository } from './infrastructure/typeorm-task-extras.repositories.js';
import { TypeOrmTaskRepository } from './infrastructure/typeorm-task.repository.js';
import { TasksResolver } from './presentation/graphql/tasks.resolver.js';

@Module({
  imports: [ListsModule, MembersModule, SpacesModule, SprintsModule, StatusesModule, CustomFieldsModule],
  providers: [
    TasksService,
    TasksResolver,
    { provide: TaskRepository, useClass: TypeOrmTaskRepository },
    { provide: TaskWatcherRepository, useClass: TypeOrmTaskWatcherRepository },
    { provide: TaskRelationRepository, useClass: TypeOrmTaskRelationRepository },
    { provide: TaskActivityRepository, useClass: TypeOrmTaskActivityRepository },
  ],
  exports: [TasksService],
})
export class TasksModule {}
