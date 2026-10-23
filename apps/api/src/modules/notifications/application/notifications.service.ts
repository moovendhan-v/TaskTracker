import { Injectable } from '@nestjs/common';
import type { NotificationResponse, Paginated } from '@taskflow/shared-types';
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
  ) {}

  async inbox(workspaceId: string, userId: string, query: PageQuery & { unreadOnly?: boolean }): Promise<Paginated<NotificationResponse>> {
    const page = toPageRequest(query);
    const result = await this.notifications.page(workspaceId, userId, { unreadOnly: query.unreadOnly ?? false }, page);
    return { items: result.items.map(NotificationMapper.toResponse), total: result.total, ...page };
  }

  unreadCount(workspaceId: string, userId: string): Promise<number> {
    return this.notifications.countUnread(workspaceId, userId);
  }

  markRead(workspaceId: string, userId: string, ids: readonly string[]): Promise<number> {
    return this.notifications.markRead(workspaceId, userId, ids, this.clock.now());
  }

  markAllRead(workspaceId: string, userId: string): Promise<number> {
    return this.notifications.markRead(workspaceId, userId, null, this.clock.now());
  }
}
