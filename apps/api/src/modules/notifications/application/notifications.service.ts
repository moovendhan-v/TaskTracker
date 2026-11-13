import { Injectable } from '@nestjs/common';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { NewNotification } from '../domain/notification.js';
import { SNOOZE_MAX_DAYS, type NotificationKind, type NotificationResponse, type Paginated } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { toPageRequest } from '../../../core/domain/page-request.js';
import type { PageQuery } from '@taskflow/shared-types';
import { Clock } from '../../../core/time/clock.port.js';
import { NotificationRepository } from '../domain/notification.repository.js';
import { NotificationMapper } from './notification.mapper.js';

/** The signed-in user's inbox in one workspace. Nobody can read or change anyone else's notifications. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly clock: Clock,
    private readonly eventBus: EventBus,
  ) {}

  /** Sends one notification per recipient (automations), in the caller's transaction, and announces each. */
  async send(drafts: readonly NewNotification[]): Promise<void> {
    for (const draft of drafts) {
      const notification = await this.notifications.create(draft);
      await this.eventBus.publish(
        domainEvent('notification', 'created', {
          workspaceId: notification.workspaceId,
          entityId: notification.id,
          actorId: draft.actorId ?? notification.recipientId,
          recipientId: notification.recipientId,
        }),
      );
    }
  }

  async inbox(workspaceId: string, userId: string, query: PageQuery & { unreadOnly?: boolean; kinds?: readonly NotificationKind[] | null; snoozed?: boolean | null }): Promise<Paginated<NotificationResponse>> {
    const page = toPageRequest(query);
    const result = await this.notifications.page(workspaceId, userId, { unreadOnly: query.unreadOnly ?? false, kinds: query.kinds ?? undefined, snoozed: query.snoozed ?? false }, this.clock.now(), page);
    return { items: result.items.map(NotificationMapper.toResponse), total: result.total, ...page };
  }

  unreadCount(workspaceId: string, userId: string): Promise<number> {
    return this.notifications.countUnread(workspaceId, userId, this.clock.now());
  }

  markRead(workspaceId: string, userId: string, ids: readonly string[]): Promise<number> {
    return this.notifications.markRead(workspaceId, userId, ids, this.clock.now());
  }

  /**
   * Hides your notifications until `until` (in the future, at most SNOOZE_MAX_DAYS ahead); they
   * come back unread then. Returns how many were snoozed.
   */
  snooze(workspaceId: string, userId: string, ids: readonly string[], until: Date): Promise<number> {
    const now = this.clock.now().getTime();
    if (!(until.getTime() > now)) throw DomainError.invalid('Snooze until a time in the future');
    if (until.getTime() > now + SNOOZE_MAX_DAYS * 86_400_000) throw DomainError.invalid(`Snooze for at most ${SNOOZE_MAX_DAYS} days`);
    return this.notifications.snooze(workspaceId, userId, ids, until);
  }

  /** Brings snoozed notifications back now. */
  unsnooze(workspaceId: string, userId: string, ids: readonly string[]): Promise<number> {
    return this.notifications.snooze(workspaceId, userId, ids, null);
  }

  markAllRead(workspaceId: string, userId: string): Promise<number> {
    return this.notifications.markRead(workspaceId, userId, null, this.clock.now());
  }
}
