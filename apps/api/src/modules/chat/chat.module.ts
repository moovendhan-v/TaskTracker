import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { ChatRetentionService } from './application/chat-retention.service.js';
import { ChatService } from './application/chat.service.js';
import { ChatRetentionRepository } from './domain/chat-retention.repository.js';
import { TypeOrmChatRetentionRepository } from './infrastructure/typeorm-chat-retention.repository.js';
import { ChatRepository } from './domain/chat.repository.js';
import { TypeOrmChatRepository } from './infrastructure/typeorm-chat.repository.js';
import { ChatRetentionResolver } from './presentation/graphql/chat-retention.resolver.js';
import { ChatResolver } from './presentation/graphql/chat.resolver.js';

/** Chat (D1): channels, direct messages, threads, task-from-message and retention. */
@Module({
  imports: [TasksModule, MembersModule],
  providers: [
    ChatService,
    ChatRetentionService,
    ChatResolver,
    ChatRetentionResolver,
    { provide: ChatRepository, useClass: TypeOrmChatRepository },
    { provide: ChatRetentionRepository, useClass: TypeOrmChatRetentionRepository },
  ],
  exports: [ChatService],
})
export class ChatModule {}
