import { Module } from '@nestjs/common';
import { OrganizationsService } from './application/organizations.service.js';
import { OrganizationRepository } from './domain/organization.repository.js';
import { TypeOrmOrganizationRepository } from './infrastructure/typeorm-organization.repository.js';
import { OrganizationsResolver } from './presentation/graphql/organizations.resolver.js';

/** A3: organizations above workspaces. */
@Module({
  providers: [OrganizationsService, OrganizationsResolver, { provide: OrganizationRepository, useClass: TypeOrmOrganizationRepository }],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
