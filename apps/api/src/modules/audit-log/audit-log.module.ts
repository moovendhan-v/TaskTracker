import { Module } from '@nestjs/common';
import { AuditLogService } from './application/audit-log.service.js';
import { AuditLogRepository } from './domain/audit-log.repository.js';
import { TypeOrmAuditLogRepository } from './infrastructure/typeorm-audit-log.repository.js';
import { WorkspaceAuditLogResolver } from './presentation/graphql/workspace-audit-log.resolver.js';

@Module({
  providers: [AuditLogService, WorkspaceAuditLogResolver, { provide: AuditLogRepository, useClass: TypeOrmAuditLogRepository }],
  exports: [AuditLogService],
})
export class AuditLogModule {}
