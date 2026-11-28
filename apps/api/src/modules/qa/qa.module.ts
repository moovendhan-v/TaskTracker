import { Module } from '@nestjs/common';
import { BugsModule } from '../bugs/bugs.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { QaService } from './application/qa.service.js';
import { QaRepository } from './domain/qa.repository.js';
import { TypeOrmQaRepository } from './infrastructure/typeorm-qa.repository.js';
import { QaResolver } from './presentation/graphql/qa.resolver.js';

/** E6.4 QA test management: suites, cases, plans, runs, approval, readiness and coverage. */
@Module({
  imports: [BugsModule, SpacesModule],
  providers: [QaService, QaResolver, { provide: QaRepository, useClass: TypeOrmQaRepository }],
})
export class QaModule {}
