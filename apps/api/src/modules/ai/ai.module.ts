import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { CommentsModule } from '../comments/comments.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { AiAssistantService } from './application/ai-assistant.service.js';
import { AiSettingsService } from './application/ai-settings.service.js';
import { AiRepository } from './domain/ai.repository.js';
import { TypeOrmAiRepository } from './infrastructure/typeorm-ai.repository.js';
import { AiResolver } from './presentation/graphql/ai.resolver.js';

/** E5 AI features. The provider layer (core/ai) is global; this module holds settings, budgets and features. */
@Module({
  imports: [TasksModule, CommentsModule, DocumentsModule, ChatModule],
  providers: [AiSettingsService, AiAssistantService, AiResolver, { provide: AiRepository, useClass: TypeOrmAiRepository }],
})
export class AiFeaturesModule {}
