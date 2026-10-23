export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  workspaceId: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditFilter {
  workspaceId?: string;
  actorId?: string;
  /** Prefix match on the action name. */
  actionPrefix?: string;
}
