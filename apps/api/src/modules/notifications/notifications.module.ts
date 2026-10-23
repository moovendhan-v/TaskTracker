import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { NotificationEventHandler } from './application/notification-event-handler.js';
import { NotificationsService } from './application/notifications.service.js';
import { NotificationRepository } from './domain/notification.repository.js';
import { TypeOrmNotificationRepository } from './infrastructure/typeorm-notification.repository.js';
import { NotificationsResolver } from './presentation/graphql/notifications.resolver.js';

@Module({
  imports: [MembersModule],
  providers: [
    NotificationsService,
    NotificationEventHandler,
    NotificationsResolver,
    { provide: NotificationRepository, useClass: TypeOrmNotificationRepository },
  ],
})
export class NotificationsModule {}
