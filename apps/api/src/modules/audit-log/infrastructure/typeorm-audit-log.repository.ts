import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import { AuditLogOrmEntity } from '../../../core/audit/audit-log.orm-entity.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { PageRequest } from '../../../core/domain/page-request.js';
import { escapeLike } from '../../../core/http/utils/escape-like.js';
import { pageRawWithResourceQuery } from '../../../core/query/apply-resource-query.js';
import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { AuditEntry, AuditFilter } from '../domain/audit-entry.js';
import { AuditLogRepository } from '../domain/audit-log.repository.js';

interface AuditRow {
  id: string;
  actor_id: string;
  actor_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  workspace_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class TypeOrmAuditLogRepository extends AuditLogRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async page(filter: AuditFilter, page: PageRequest): Promise<{ items: AuditEntry[]; total: number }> {
    const base = () => this.filtered(this.transactional.repository(AuditLogOrmEntity).createQueryBuilder('log'), filter);
    // Sequential on purpose: an operation's queries share one transaction connection, which runs one query at a time.
    const rows = await withActorColumns(base())
      .orderBy('log.id', 'DESC')
      .offset((page.page - 1) * page.pageSize)
      .limit(page.pageSize)
      .getRawMany<AuditRow>();
    const total = await base().getCount();
    return { items: rows.map(toEntry), total };
  }

  async search(workspaceId: string, query: NormalizedQuery): Promise<{ items: AuditEntry[]; total: number }> {
    const builder = withActorColumns(this.transactional.repository(AuditLogOrmEntity).createQueryBuilder('log')).where('log.workspace_id = :workspaceId', {
      workspaceId,
    });
    const { rows, total } = await pageRawWithResourceQuery<AuditRow>(builder, query);
    return { items: rows.map(toEntry), total };
  }

  private filtered(query: SelectQueryBuilder<AuditLogOrmEntity>, filter: AuditFilter): SelectQueryBuilder<AuditLogOrmEntity> {
    query.where('1 = 1');
    if (filter.workspaceId) query.andWhere('log.workspace_id = :workspaceId', { workspaceId: filter.workspaceId });
    if (filter.actorId) query.andWhere('log.actor_id = :actorId', { actorId: filter.actorId });
    if (filter.actionPrefix) query.andWhere('log.action LIKE :action', { action: `${escapeLike(filter.actionPrefix)}%` });
    return query;
  }
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: String(row.id),
    actorId: row.actor_id,
    actorName: row.actor_name ?? (row.actor_id.startsWith('system:') ? 'System' : 'Former user'),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    workspaceId: row.workspace_id,
    ip: row.ip,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
  };
}

function withActorColumns(query: SelectQueryBuilder<AuditLogOrmEntity>): SelectQueryBuilder<AuditLogOrmEntity> {
  return query
    .leftJoin('user', 'actor', 'actor.id = log.actor_id')
    .select([
      'log.id AS id',
      'log.actor_id AS actor_id',
      'actor.name AS actor_name',
      'log.action AS action',
      'log.target_type AS target_type',
      'log.target_id AS target_id',
      'log.workspace_id AS workspace_id',
      'log.ip AS ip',
      'log.metadata AS metadata',
      'log.created_at AS created_at',
    ]);
}
