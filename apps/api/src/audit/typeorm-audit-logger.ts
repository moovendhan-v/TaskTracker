import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Actor } from '../common/http/authenticated-request.js';
import { AuditLogEntity } from './audit-log.entity.js';
import { AuditLogger, type AuditEntry } from './audit-logger.js';

@Injectable()
export class TypeOrmAuditLogger extends AuditLogger {
  constructor(@InjectRepository(AuditLogEntity) private readonly repository: Repository<AuditLogEntity>) {
    super();
  }

  async record(actor: Actor, entry: AuditEntry): Promise<void> {
    await this.repository.insert({
      actorId: actor.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      workspaceId: entry.workspaceId ?? null,
      ip: actor.ip,
      metadata: { ...entry.metadata, ...(actor.platformRole === 'SUPER_ADMIN' ? { actorPlatformRole: 'SUPER_ADMIN' } : {}) },
    });
  }
}
