import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { CustomFieldsService } from './application/custom-fields.service.js';
import { CustomFieldRepository } from './domain/custom-field.repository.js';
import { TypeOrmCustomFieldRepository } from './infrastructure/typeorm-custom-field.repository.js';
import { CustomFieldsResolver } from './presentation/graphql/custom-fields.resolver.js';

/** Typed fields a workspace adds to tasks and spaces. */
@Module({
  imports: [SpacesModule],
  providers: [CustomFieldsService, CustomFieldsResolver, { provide: CustomFieldRepository, useClass: TypeOrmCustomFieldRepository }],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
