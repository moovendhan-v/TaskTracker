import { Injectable } from '@nestjs/common';
import type { Actor } from '../http/types/authenticated-request.js';
import { TransactionalManager } from '../database/transactional-manager.js';
import { AuditLogOrmEntity } from './audit-log.orm-entity.js';
import { AuditLogger, type AuditEntry } from './audit-logger.port.js';

/** Writes inside the caller's transaction when there is one, so audit and change commit together. */
@Injectable()
export class TypeOrmAuditLogger extends AuditLogger {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async record(actor: Actor, entry: AuditEntry): Promise<void> {
    const platformMeta = actor.platformRole === 'SUPER_ADMIN' ? { actorPlatformRole: 'SUPER_ADMIN' } : {};
    await this.transactional.repository(AuditLogOrmEntity).insert({
      actorId: actor.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      workspaceId: entry.workspaceId ?? null,
      ip: actor.ip,
      metadata: { ...entry.metadata, ...platformMeta },
    });
  }
}
