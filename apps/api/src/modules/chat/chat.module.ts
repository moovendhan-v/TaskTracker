import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module.js';
import { ChatService } from './application/chat.service.js';
import { ChatRepository } from './domain/chat.repository.js';
import { TypeOrmChatRepository } from './infrastructure/typeorm-chat.repository.js';
import { ChatResolver } from './presentation/graphql/chat.resolver.js';

/** Chat (D1): channels, direct messages, threads and task-from-message. */
@Module({
  imports: [TasksModule],
  providers: [ChatService, ChatResolver, { provide: ChatRepository, useClass: TypeOrmChatRepository }],
})
export class ChatModule {}
