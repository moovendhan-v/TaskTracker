import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { BugsService } from './application/bugs.service.js';
import { BugRepository } from './domain/bug.repository.js';
import { TypeOrmBugRepository } from './infrastructure/typeorm-bug.repository.js';
import { BugsResolver } from './presentation/graphql/bugs.resolver.js';

/** E6 visual bug reports and feedback, on top of tasks. */
@Module({
  imports: [TasksModule, ListsModule],
  providers: [BugsService, BugsResolver, { provide: BugRepository, useClass: TypeOrmBugRepository }],
  exports: [BugsService],
})
export class BugsModule {}
