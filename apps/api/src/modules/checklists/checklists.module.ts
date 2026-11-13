import { Module } from '@nestjs/common';
import { ChecklistsService } from './application/checklists.service.js';
import { ChecklistRepository } from './domain/checklist.repository.js';
import { TypeOrmChecklistRepository } from './infrastructure/typeorm-checklist.repository.js';
import { ChecklistsResolver } from './presentation/graphql/checklists.resolver.js';

/** Checklists on tasks (C2). */
@Module({
  providers: [ChecklistsService, ChecklistsResolver, { provide: ChecklistRepository, useClass: TypeOrmChecklistRepository }],
})
export class ChecklistsModule {}
