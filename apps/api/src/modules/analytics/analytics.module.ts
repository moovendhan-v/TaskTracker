import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { AnalyticsService } from './application/analytics.service.js';
import { AnalyticsRepository } from './domain/analytics.repository.js';
import { SqlAnalyticsRepository } from './infrastructure/sql-analytics.repository.js';
import { AnalyticsResolver } from './presentation/graphql/analytics.resolver.js';

/** Dashboards: task counts, workload and hours, for the workspace or one project. */
@Module({
  imports: [SpacesModule],
  providers: [AnalyticsService, AnalyticsResolver, { provide: AnalyticsRepository, useClass: SqlAnalyticsRepository }],
})
export class AnalyticsModule {}
