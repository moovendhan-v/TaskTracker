import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { DocumentsResolver } from './presentation/graphql/documents.resolver.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { DocTemplatesService } from './application/doc-templates.service.js';
import { DocumentsService } from './application/documents.service.js';
import { LiveDocsService } from './application/live-docs.service.js';
import { LiveDocsGateway } from './presentation/ws/live-docs.gateway.js';
import { ContentSanitizer } from './domain/content-sanitizer.port.js';
import { DocTemplateRepository } from './domain/doc-template.repository.js';
import { DocumentRepository } from './domain/document.repository.js';
import { LiveDocRelay } from './domain/live-doc-relay.port.js';
import { LocalLiveDocRelay, RedisLiveDocRelay } from './infrastructure/live-doc-relay.js';
import { MarkdownSanitizer } from './infrastructure/markdown.sanitizer.js';
import { TypeOrmDocTemplateRepository } from './infrastructure/typeorm-doc-template.repository.js';
import { TypeOrmDocumentRepository } from './infrastructure/typeorm-document.repository.js';
import { DocTemplatesResolver } from './presentation/graphql/doc-templates.resolver.js';

@Module({
  imports: [SpacesModule],
  providers: [
    DocumentsService,
    DocumentsResolver,
    DocTemplatesService,
    DocTemplatesResolver,
    { provide: DocTemplateRepository, useClass: TypeOrmDocTemplateRepository },
    LiveDocsService,
    LiveDocsGateway,
    {
      // Live rooms span API instances through Redis when it's set (required in production).
      provide: LiveDocRelay,
      inject: [ENV],
      useFactory: (env: Env): LiveDocRelay => (env.REDIS_URL ? new RedisLiveDocRelay(env.REDIS_URL, randomUUID()) : new LocalLiveDocRelay()),
    },
    { provide: DocumentRepository, useClass: TypeOrmDocumentRepository },
    { provide: ContentSanitizer, useClass: MarkdownSanitizer },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
