import { Injectable } from '@nestjs/common';
import type { CommentResponse, CreateCommentRequest, UpdateCommentRequest } from '@taskflow/shared-types';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess, workspaceFromArg } from '../../../core/runtime/change-target.js';
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
    private readonly eventBus: EventBus,
  ) {}

  @Cached({ entities: ['comment', 'task'], shared: true })
  async list(workspaceId: string, taskId: string): Promise<CommentResponse[]> {
    await this.tasksService.get(workspaceId, taskId);
    const comments = await this.comments.listForTask(workspaceId, taskId, MAX_COMMENTS_PER_TASK);
    return comments.map(CommentMapper.toResponse);
  }

  async create(actor: Actor, workspaceId: string, taskId: string, request: CreateCommentRequest): Promise<CommentResponse> {
    const task = await this.tasksService.participants(workspaceId, taskId);
    const created = await this.comments.create({ workspaceId, taskId, authorId: actor.userId, body: request.body.trim() });
    await this.eventBus.publish(
      domainEvent('comment', 'created', {
        workspaceId,
        entityId: created.id,
        actorId: actor.userId,
        facts: { taskId, title: task.title, assigneeId: task.assigneeId, createdById: task.createdById, watcherIds: task.watcherIds, excerpt: created.body },
      }),
    );
    return CommentMapper.toResponse(await this.getInWorkspace(workspaceId, created.id));
  }

  @Announces('comment.updated', workspaceFromArg)
  async update(actor: Actor, workspaceId: string, commentId: string, request: UpdateCommentRequest): Promise<CommentResponse> {
    const comment = await this.getInWorkspace(workspaceId, commentId);
    CommentOwnershipPolicy.assertCanEdit(comment, actor.userId);
    comment.body = request.body.trim();
    await this.comments.save(comment);
    return CommentMapper.toResponse(await this.getInWorkspace(workspaceId, commentId));
  }

  @Announces('comment.deleted', workspaceFromAccess)
  async remove(actor: Actor, access: WorkspaceAccess, commentId: string): Promise<CommentResponse> {
    const comment = await this.getInWorkspace(access.workspaceId, commentId);
    CommentOwnershipPolicy.assertCanDelete(comment, actor.userId, access.permissions);
    await this.comments.delete(access.workspaceId, commentId);
    return CommentMapper.toResponse(comment);
  }

  private async getInWorkspace(workspaceId: string, commentId: string): Promise<CommentWithAuthor> {
    return found(await this.comments.findInWorkspace(workspaceId, commentId), 'Comment');
  }
}
