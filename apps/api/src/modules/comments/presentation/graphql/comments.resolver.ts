import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { cappedListComplexity } from '../../../../core/graphql/page.type.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { CommentsService } from '../../application/comments.service.js';
import { CommentGql, CommentInput } from './comment.types.js';

@Resolver(() => CommentGql)
export class CommentsResolver {
  constructor(private readonly commentsService: CommentsService) {}

  @Query(() => [CommentGql], { complexity: cappedListComplexity(200) })
  @RequirePermissions('task.view')
  comments(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<CommentGql[]> {
    return this.commentsService.list(access.workspaceId, taskId);
  }

  @Mutation(() => CommentGql)
  @RequirePermissions('task.update')
  createComment(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('taskId') taskId: string,
    @Args('input') input: CommentInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CommentGql> {
    return this.commentsService.create(actor, access.workspaceId, taskId, input);
  }

  @Mutation(() => CommentGql, { description: 'Only the author can edit' })
  @RequirePermissions('task.update')
  updateComment(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('commentId') commentId: string,
    @Args('input') input: CommentInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CommentGql> {
    return this.commentsService.update(actor, access.workspaceId, commentId, input);
  }

  @Mutation(() => Boolean, { description: 'The author, or anyone with task.delete' })
  @RequirePermissions('task.view')
  async deleteComment(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('commentId') commentId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.commentsService.remove(actor, access, commentId);
    return true;
  }
}
