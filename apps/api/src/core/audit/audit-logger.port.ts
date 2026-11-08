import type { Actor } from '../http/types/authenticated-request.js';

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string | null;
  workspaceId?: string | null;
  /** Also shown in this organization's activity (A3). */
  organizationId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Port for writing audit entries. Features depend on this, not on the storage. */
export abstract class AuditLogger {
  abstract record(actor: Actor, entry: AuditEntry): Promise<void>;
}
