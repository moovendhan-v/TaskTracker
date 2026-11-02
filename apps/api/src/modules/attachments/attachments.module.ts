import { Module } from '@nestjs/common';
import { TaskAttachmentsService } from './application/task-attachments.service.js';
import { TaskAttachmentRepository } from './domain/task-attachment.repository.js';
import { TypeOrmTaskAttachmentRepository } from './infrastructure/typeorm-task-attachment.repository.js';
import { TaskAttachmentsResolver } from './presentation/graphql/task-attachments.resolver.js';

/** Files on tasks, on the shared private storage (core/storage). */
@Module({
  providers: [TaskAttachmentsService, TaskAttachmentsResolver, { provide: TaskAttachmentRepository, useClass: TypeOrmTaskAttachmentRepository }],
})
export class AttachmentsModule {}
