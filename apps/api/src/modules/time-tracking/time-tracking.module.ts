import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { TimeTrackingService } from './application/time-tracking.service.js';
import { TimeEntryRepository } from './domain/time-entry.repository.js';
import { TypeOrmTimeEntryRepository } from './infrastructure/typeorm-time-entry.repository.js';
import { TimeResolver } from './presentation/graphql/time.resolver.js';

/** Timers, logged time, timesheets and the daily log. */
@Module({
  imports: [SpacesModule, TasksModule],
  providers: [TimeTrackingService, TimeResolver, { provide: TimeEntryRepository, useClass: TypeOrmTimeEntryRepository }],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
