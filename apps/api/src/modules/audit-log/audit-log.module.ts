import { Module } from '@nestjs/common';
import { AuditLogService } from './application/audit-log.service.js';
import { AuditLogRepository } from './domain/audit-log.repository.js';
import { TypeOrmAuditLogRepository } from './infrastructure/typeorm-audit-log.repository.js';
import { WorkspaceAuditLogController } from './presentation/workspace-audit-log.controller.js';

@Module({
  controllers: [WorkspaceAuditLogController],
  providers: [AuditLogService, { provide: AuditLogRepository, useClass: TypeOrmAuditLogRepository }],
  exports: [AuditLogService],
})
export class AuditLogModule {}
