import { Global, Module } from '@nestjs/common';
import { AuditLogger } from './audit-logger.port.js';
import { TypeOrmAuditLogger } from './typeorm-audit-logger.js';

@Global()
@Module({
  providers: [{ provide: AuditLogger, useClass: TypeOrmAuditLogger }],
  exports: [AuditLogger],
})
export class AuditModule {}
