import { Injectable, type OnModuleInit } from '@nestjs/common';
import { domainEvent, type DomainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import { MembersService } from '../../members/application/members.service.js';
import { NotificationRules } from '../domain/notification-rules.js';
import { NotificationRepository } from '../domain/notification.repository.js';

/**
 * Turns domain events into notifications, in the same transaction as the change,
 * then announces each one so the recipient's inbox updates live.
 */
@Injectable()
export class NotificationEventHandler implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly notifications: NotificationRepository,
    private readonly membersService: MembersService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe((event) => this.handle(event));
  }

  private async handle(event: DomainEvent): Promise<void> {
    if (event.entityType === 'notification') return;
    const approverIds = NotificationRules.needsApprovers(event)
      ? await this.membersService.listUserIdsWithPermission(event.workspaceId, 'leave.approve')
      : [];

    for (const draft of NotificationRules.notificationsFor(event, { approverIds })) {
      const notification = await this.notifications.create(draft);
      await this.eventBus.publish(
        domainEvent('notification', 'created', {
          workspaceId: notification.workspaceId,
          entityId: notification.id,
          actorId: event.actorId,
          recipientId: notification.recipientId,
        }),
      );
    }
  }
}
