import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { DashboardsService } from './application/dashboards.service.js';
import { LayoutsService } from './application/layouts.service.js';
import { DashboardRepository } from './domain/dashboard.repository.js';
import { LayoutRepository } from './domain/layout.repository.js';
import { TypeOrmDashboardRepository } from './infrastructure/typeorm-dashboard.repository.js';
import { TypeOrmLayoutRepository } from './infrastructure/typeorm-layout.repository.js';
import { DashboardsResolver } from './presentation/graphql/dashboards.resolver.js';
import { LayoutsResolver } from './presentation/graphql/layouts.resolver.js';

/** Personal, arrangeable page layouts (the v2 block grid) and named dashboards (Home and project pages). */
@Module({
  imports: [SpacesModule],
  providers: [
    LayoutsService,
    LayoutsResolver,
    DashboardsService,
    DashboardsResolver,
    { provide: LayoutRepository, useClass: TypeOrmLayoutRepository },
    { provide: DashboardRepository, useClass: TypeOrmDashboardRepository },
  ],
})
export class LayoutsModule {}
