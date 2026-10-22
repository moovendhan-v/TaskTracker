import type { PageRequest } from '../../../core/http/dto/page-query.dto.js';
import type { AuditEntry, AuditFilter } from './audit-entry.js';

/** Read side of the append-only audit log. Writing goes through core's AuditLogger port. */
export abstract class AuditLogRepository {
  /** Newest first. */
  abstract page(filter: AuditFilter, page: PageRequest): Promise<{ items: AuditEntry[]; total: number }>;
}
