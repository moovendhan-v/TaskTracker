import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { BugsModule } from '../bugs/bugs.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { ApiTokensService } from './application/api-tokens.service.js';
import { ApiTokenRepository } from './domain/api-token.repository.js';
import { TypeOrmApiTokenRepository } from './infrastructure/typeorm-api-token.repository.js';
import { ApiTokensResolver } from './presentation/graphql/api-tokens.resolver.js';
import { ExtensionController } from './presentation/http/extension.controller.js';

/** E6.3 personal API tokens and the browser extension's API. */
@Module({
  imports: [BugsModule, AttachmentsModule, SpacesModule],
  controllers: [ExtensionController],
  providers: [ApiTokensService, ApiTokensResolver, { provide: ApiTokenRepository, useClass: TypeOrmApiTokenRepository }],
  exports: [ApiTokensService],
})
export class ApiTokensModule {}
