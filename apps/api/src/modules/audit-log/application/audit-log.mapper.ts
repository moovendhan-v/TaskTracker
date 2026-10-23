import type { AuditLogEntryResponse } from '@taskflow/shared-types';
import type { AuditEntry } from '../domain/audit-entry.js';

export const AuditLogMapper = {
  /** Workspace admins see actions in their workspace but not IP addresses. */
  forWorkspace(entry: AuditEntry): AuditLogEntryResponse {
    return { ...AuditLogMapper.forPlatform(entry), ip: null };
  },

  forPlatform(entry: AuditEntry): AuditLogEntryResponse {
    return {
      id: entry.id,
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      workspaceId: entry.workspaceId,
      ip: entry.ip,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
    };
  },
};
