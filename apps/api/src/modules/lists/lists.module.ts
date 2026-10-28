import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { FoldersService } from './application/folders.service.js';
import { ListsService } from './application/lists.service.js';
import { ListFolderRepository } from './domain/list-folder.repository.js';
import { TaskListRepository } from './domain/task-list.repository.js';
import { TypeOrmListFolderRepository } from './infrastructure/typeorm-list-folder.repository.js';
import { TypeOrmTaskListRepository } from './infrastructure/typeorm-task-list.repository.js';
import { FoldersResolver } from './presentation/graphql/folders.resolver.js';
import { ListsResolver } from './presentation/graphql/lists.resolver.js';

@Module({
  imports: [SpacesModule],
  providers: [
    ListsService,
    FoldersService,
    ListsResolver,
    FoldersResolver,
    { provide: TaskListRepository, useClass: TypeOrmTaskListRepository },
    { provide: ListFolderRepository, useClass: TypeOrmListFolderRepository },
  ],
  exports: [ListsService, FoldersService],
})
export class ListsModule {}
