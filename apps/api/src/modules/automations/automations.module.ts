import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { MembersModule } from '../members/members.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { AutomationEngine } from './application/automation-engine.js';
import { AutomationsService } from './application/automations.service.js';
import { AutomationRepository } from './domain/automation.repository.js';
import { TypeOrmAutomationRepository } from './infrastructure/typeorm-automation.repository.js';
import { AutomationsResolver } from './presentation/graphql/automations.resolver.js';

@Module({
  imports: [SpacesModule, StatusesModule, ListsModule, MembersModule, TasksModule, NotificationsModule],
  providers: [AutomationsService, AutomationEngine, AutomationsResolver, { provide: AutomationRepository, useClass: TypeOrmAutomationRepository }],
  exports: [AutomationEngine],
})
export class AutomationsModule {}
