import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { ListsModule } from '../lists/lists.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { TemplatesService } from './application/templates.service.js';
import { ProjectTemplateRepository } from './domain/project-template.repository.js';
import { TypeOrmProjectTemplateRepository } from './infrastructure/typeorm-project-template.repository.js';
import { TemplatesResolver } from './presentation/graphql/templates.resolver.js';

@Module({
  imports: [SpacesModule, StatusesModule, CustomFieldsModule, ListsModule, TasksModule, DocumentsModule],
  providers: [TemplatesService, TemplatesResolver, { provide: ProjectTemplateRepository, useClass: TypeOrmProjectTemplateRepository }],
})
export class TemplatesModule {}
