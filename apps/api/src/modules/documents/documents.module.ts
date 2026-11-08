import { Module } from '@nestjs/common';
import { DocumentsResolver } from './presentation/graphql/documents.resolver.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { DocumentsService } from './application/documents.service.js';
import { LiveDocsService } from './application/live-docs.service.js';
import { LiveDocsGateway } from './presentation/ws/live-docs.gateway.js';
import { ContentSanitizer } from './domain/content-sanitizer.port.js';
import { DocumentRepository } from './domain/document.repository.js';
import { MarkdownSanitizer } from './infrastructure/markdown.sanitizer.js';
import { TypeOrmDocumentRepository } from './infrastructure/typeorm-document.repository.js';

@Module({
  imports: [SpacesModule],
  providers: [
    DocumentsService,
    DocumentsResolver,
    LiveDocsService,
    LiveDocsGateway,
    { provide: DocumentRepository, useClass: TypeOrmDocumentRepository },
    { provide: ContentSanitizer, useClass: MarkdownSanitizer },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
