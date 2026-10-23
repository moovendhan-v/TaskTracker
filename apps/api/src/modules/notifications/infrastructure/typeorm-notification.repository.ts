import { Injectable } from '@nestjs/common';
import { IsNull, type SelectQueryBuilder } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { PageRequest } from '../../../core/domain/page-request.js';
import type { NewNotification, Notification, NotificationKind, NotificationView } from '../domain/notification.js';
import { NotificationRepository, type InboxFilter } from '../domain/notification.repository.js';
import { NotificationOrmEntity } from './notification.orm-entity.js';

interface ViewRow {
  id: string;
  workspace_id: string;
  recipient_id: string;
  actor_id: string | null;
  actor_name: string | null;
  kind: NotificationKind;
  entity_type: string;
  entity_id: string;
  task_id: string | null;
  subject: string;
  excerpt: string;
  read_at: Date | null;
  created_at: Date;
}

@Injectable()
export class TypeOrmNotificationRepository extends NotificationRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(NotificationOrmEntity);
  }

  create(notification: NewNotification): Promise<Notification> {
    return this.repository.save(this.repository.create(notification));
  }

  async page(workspaceId: string, recipientId: string, filter: InboxFilter, page: PageRequest): Promise<{ items: NotificationView[]; total: number }> {
    // Sequential on purpose: an operation's queries share one transaction connection, which runs one query at a time.
    const rows = await this.inbox(workspaceId, recipientId, filter)
      .leftJoin('user', 'actor', 'actor.id = notification.actor_id')
      .select([
        'notification.id AS id',
        'notification.workspace_id AS workspace_id',
        'notification.recipient_id AS recipient_id',
        'notification.actor_id AS actor_id',
        'actor.name AS actor_name',
        'notification.kind AS kind',
        'notification.entity_type AS entity_type',
        'notification.entity_id AS entity_id',
        'notification.task_id AS task_id',
        'notification.subject AS subject',
        'notification.excerpt AS excerpt',
        'notification.read_at AS read_at',
        'notification.created_at AS created_at',
      ])
      .orderBy('notification.created_at', 'DESC')
      .offset((page.page - 1) * page.pageSize)
      .limit(page.pageSize)
      .getRawMany<ViewRow>();
    const total = await this.inbox(workspaceId, recipientId, filter).getCount();
    return { items: rows.map(toView), total };
  }

  countUnread(workspaceId: string, recipientId: string): Promise<number> {
    return this.repository.countBy({ workspaceId, recipientId, readAt: IsNull() });
  }

  async markRead(workspaceId: string, recipientId: string, ids: readonly string[] | null, at: Date): Promise<number> {
    const query = this.repository
      .createQueryBuilder()
      .update()
      .set({ readAt: at })
      .where('workspace_id = :workspaceId AND recipient_id = :recipientId AND read_at IS NULL', { workspaceId, recipientId });
    if (ids) query.andWhere('id IN (:...ids)', { ids });
    const result = await query.execute();
    return result.affected ?? 0;
  }

  private inbox(workspaceId: string, recipientId: string, filter: InboxFilter): SelectQueryBuilder<NotificationOrmEntity> {
    const query = this.repository
      .createQueryBuilder('notification')
      .where('notification.workspace_id = :workspaceId AND notification.recipient_id = :recipientId', { workspaceId, recipientId });
    if (filter.unreadOnly) query.andWhere('notification.read_at IS NULL');
    return query;
  }
}

function toView(row: ViewRow): NotificationView {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    kind: row.kind,
    entityType: row.entity_type,
    entityId: row.entity_id,
    taskId: row.task_id,
    subject: row.subject,
    excerpt: row.excerpt,
    readAt: row.read_at ? new Date(row.read_at) : null,
    createdAt: new Date(row.created_at),
  };
}
