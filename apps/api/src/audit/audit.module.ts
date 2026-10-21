import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './audit-log.entity.js';
import { AuditLogger } from './audit-logger.js';
import { TypeOrmAuditLogger } from './typeorm-audit-logger.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [{ provide: AuditLogger, useClass: TypeOrmAuditLogger }],
  exports: [AuditLogger],
})
export class AuditModule {}
