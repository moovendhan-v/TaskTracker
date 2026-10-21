import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListsModule } from '../lists/lists.module.js';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import { TaskEntity } from './entities/task.entity.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, WorkspaceMemberEntity]), ListsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
