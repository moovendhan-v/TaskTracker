import { Module } from '@nestjs/common';
import { ResourceSchemaService } from './application/resource-schema.service.js';
import { ResourceSchemaResolver } from './presentation/graphql/resource-schema.resolver.js';

/** The `resourceSchema` query. Resources themselves are declared by each feature (see core/query). */
@Module({
  providers: [ResourceSchemaService, ResourceSchemaResolver],
})
export class ResourcesModule {}
