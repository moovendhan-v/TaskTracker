import { Module } from '@nestjs/common';
import { CommentsResolver } from './presentation/graphql/comments.resolver.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { CommentsService } from './application/comments.service.js';
import { CommentRepository } from './domain/comment.repository.js';
import { TypeOrmCommentRepository } from './infrastructure/typeorm-comment.repository.js';

@Module({
  imports: [TasksModule],
  providers: [CommentsService, CommentsResolver, { provide: CommentRepository, useClass: TypeOrmCommentRepository }],
  exports: [CommentsService],
})
export class CommentsModule {}
