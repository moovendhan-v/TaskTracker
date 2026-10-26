import { Injectable } from '@nestjs/common';
import type { AuditLogEntryResponse, AuditLogQuery, Paginated } from '@taskflow/shared-types';
import { toPageRequest } from '../../../core/domain/page-request.js';
import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { AuditEntry } from '../domain/audit-entry.js';
import { AuditLogRepository } from '../domain/audit-log.repository.js';
import { AuditLogMapper } from './audit-log.mapper.js';

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLog: AuditLogRepository) {}

  /** The workspace id comes from the access check, never from the query. */
  forWorkspace(workspaceId: string, query: AuditLogQuery): Promise<Paginated<AuditLogEntryResponse>> {
    return this.list({ workspaceId, actorId: query.actorId, actionPrefix: query.action }, query, AuditLogMapper.forWorkspace);
  }

  /** The workspace's entries matching a resource query; never includes IP addresses. */
  async searchWorkspace(workspaceId: string, query: NormalizedQuery): Promise<Paginated<AuditLogEntryResponse>> {
    const result = await this.auditLog.search(workspaceId, query);
    return { items: result.items.map(AuditLogMapper.forWorkspace), total: result.total, page: query.page, pageSize: query.pageSize };
  }

  forPlatform(query: AuditLogQuery): Promise<Paginated<AuditLogEntryResponse>> {
    return this.list(
      { workspaceId: query.workspaceId, actorId: query.actorId, actionPrefix: query.action },
      query,
      AuditLogMapper.forPlatform,
    );
  }

  private async list(
    filter: Parameters<AuditLogRepository['page']>[0],
    query: AuditLogQuery,
    map: (entry: AuditEntry) => AuditLogEntryResponse,
  ): Promise<Paginated<AuditLogEntryResponse>> {
    const page = toPageRequest(query);
    const result = await this.auditLog.page(filter, page);
    return { items: result.items.map(map), total: result.total, ...page };
  }
}
