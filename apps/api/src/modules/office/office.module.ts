import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { OfficeService } from './application/office.service.js';
import { OfficeRepository } from './domain/office.repository.js';
import { TypeOrmOfficeRepository } from './infrastructure/typeorm-office.repository.js';
import { OfficeResolver } from './presentation/graphql/office.resolver.js';

/** D3: the virtual office, on top of chat and calls. */
@Module({
  imports: [ChatModule],
  providers: [OfficeService, OfficeResolver, { provide: OfficeRepository, useClass: TypeOrmOfficeRepository }],
})
export class OfficeModule {}
