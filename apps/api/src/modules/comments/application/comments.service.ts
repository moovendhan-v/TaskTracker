import { Injectable } from '@nestjs/common';
import type { CommentResponse, CreateCommentRequest, UpdateCommentRequest } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import type { CommentWithAuthor } from '../domain/comment.js';
import { CommentOwnershipPolicy } from '../domain/comment-ownership.policy.js';
import { CommentRepository } from '../domain/comment.repository.js';
import { CommentMapper } from './comment.mapper.js';

/** Comments per task are capped; older threads beyond this are rare and can be paged later. */
const MAX_COMMENTS_PER_TASK = 200;

@Injectable()
export class CommentsService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly tasksService: TasksService,
  ) {}

  async list(workspaceId: string, taskId: string): Promise<CommentResponse[]> {
    await this.tasksService.get(workspaceId, taskId);
    const comments = await this.comments.listForTask(workspaceId, taskId, MAX_COMMENTS_PER_TASK);
    return comments.map(CommentMapper.toResponse);
  }

  async create(actor: Actor, workspaceId: string, taskId: string, request: CreateCommentRequest): Promise<CommentResponse> {
    await this.tasksService.get(workspaceId, taskId);
    const created = await this.comments.create({ workspaceId, taskId, authorId: actor.userId, body: request.body.trim() });
    return CommentMapper.toResponse(await this.getInWorkspace(workspaceId, created.id));
  }

  async update(actor: Actor, workspaceId: string, commentId: string, request: UpdateCommentRequest): Promise<CommentResponse> {
    const comment = await this.getInWorkspace(workspaceId, commentId);
    CommentOwnershipPolicy.assertCanEdit(comment, actor.userId);
    comment.body = request.body.trim();
    await this.comments.save(comment);
    return CommentMapper.toResponse(await this.getInWorkspace(workspaceId, commentId));
  }

  async remove(actor: Actor, access: WorkspaceAccess, commentId: string): Promise<void> {
    const comment = await this.getInWorkspace(access.workspaceId, commentId);
    CommentOwnershipPolicy.assertCanDelete(comment, actor.userId, access.permissions);
    await this.comments.delete(access.workspaceId, commentId);
  }

  private async getInWorkspace(workspaceId: string, commentId: string): Promise<CommentWithAuthor> {
    const comment = await this.comments.findInWorkspace(workspaceId, commentId);
    if (!comment) throw DomainError.notFound('Comment');
    return comment;
  }
}
