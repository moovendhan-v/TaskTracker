import { Module } from '@nestjs/common';
import { CommentsResolver } from './presentation/graphql/comments.resolver.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { CommentsService } from './application/comments.service.js';
import { CommentRepository } from './domain/comment.repository.js';
import { TypeOrmCommentRepository } from './infrastructure/typeorm-comment.repository.js';
import { CommentsController } from './presentation/comments.controller.js';

@Module({
  imports: [TasksModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsResolver, { provide: CommentRepository, useClass: TypeOrmCommentRepository }],
})
export class CommentsModule {}
