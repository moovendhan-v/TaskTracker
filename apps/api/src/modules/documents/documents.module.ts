import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { DocumentsService } from './application/documents.service.js';
import { ContentSanitizer } from './domain/content-sanitizer.port.js';
import { DocumentRepository } from './domain/document.repository.js';
import { MarkdownSanitizer } from './infrastructure/markdown.sanitizer.js';
import { TypeOrmDocumentRepository } from './infrastructure/typeorm-document.repository.js';
import { DocumentsController } from './presentation/documents.controller.js';

@Module({
  imports: [SpacesModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    { provide: DocumentRepository, useClass: TypeOrmDocumentRepository },
    { provide: ContentSanitizer, useClass: MarkdownSanitizer },
  ],
})
export class DocumentsModule {}
