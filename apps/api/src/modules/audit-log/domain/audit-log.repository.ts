import type { PageRequest } from '../../../core/domain/page-request.js';
import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { AuditEntry, AuditFilter } from './audit-entry.js';

/** Read side of the append-only audit log. Writing goes through core's AuditLogger port. */
export abstract class AuditLogRepository {
  /** Newest first. */
  abstract page(filter: AuditFilter, page: PageRequest): Promise<{ items: AuditEntry[]; total: number }>;
  /** A workspace's entries matching a validated resource query. */
  abstract search(workspaceId: string, query: NormalizedQuery): Promise<{ items: AuditEntry[]; total: number }>;
}
