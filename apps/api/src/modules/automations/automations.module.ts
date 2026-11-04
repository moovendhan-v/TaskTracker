import { CryptoModule } from '../../core/crypto/crypto.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { CommentsModule } from '../comments/comments.module.js';
import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { MembersModule } from '../members/members.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { AutomationEngine } from './application/automation-engine.js';
import { AutomationScheduler } from './application/automation-scheduler.js';
import { AutomationsService } from './application/automations.service.js';
import { AutomationRepository } from './domain/automation.repository.js';
import { TypeOrmAutomationRepository } from './infrastructure/typeorm-automation.repository.js';
import { AutomationsResolver } from './presentation/graphql/automations.resolver.js';

@Module({
  imports: [SpacesModule, StatusesModule, ListsModule, MembersModule, TasksModule, NotificationsModule, CommentsModule, ChatModule, CryptoModule],
  providers: [AutomationsService, AutomationEngine, AutomationScheduler, AutomationsResolver, { provide: AutomationRepository, useClass: TypeOrmAutomationRepository }],
  exports: [AutomationEngine],
})
export class AutomationsModule {}
