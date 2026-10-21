import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpacesModule } from '../spaces/spaces.module.js';
import { TaskListEntity } from './entities/task-list.entity.js';
import { ListsController } from './lists.controller.js';
import { ListsService } from './lists.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TaskListEntity]), SpacesModule],
  controllers: [ListsController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
