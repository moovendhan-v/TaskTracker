import { Injectable } from '@nestjs/common';
import { canInSpace, mentionedUserIds, mentionsToNames, type CommentResponse, type CreateCommentRequest, type UpdateCommentRequest } from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
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
    private readonly accessService: AccessService,
  ) {}

  /**
   * Who a comment's @mentions notify: workspace members who can see the task (in its space),
   * never the author, and (on an edit) only people it didn't mention before. A mention of
   * someone who can't see the task tells them nothing. Also the excerpt, with names for ids.
   */
  private async mentions(actor: Actor, workspaceId: string, taskId: string, body: string, before = ''): Promise<{ mentionIds: string[]; excerpt: string }> {
    const already = new Set(mentionedUserIds(before));
    const candidates = mentionedUserIds(body).filter((id) => id !== actor.userId && !already.has(id));
    const spaceId = await this.tasksService.spaceIdOf(workspaceId, taskId);
    const mentionIds: string[] = [];
    for (const id of candidates) {
      const access = await this.accessService.resolveMember(id, workspaceId);
      if (access && canInSpace(access, spaceId, 'task.view')) mentionIds.push(id);
    }
    const names = await this.comments.memberNames(workspaceId, mentionedUserIds(body));
    return { mentionIds, excerpt: mentionsToNames(body, (id) => names.get(id)) };
  }

  @Cached({ entities: ['comment', 'task'], shared: true })
  async list(workspaceId: string, taskId: string): Promise<CommentResponse[]> {
    await this.tasksService.get(workspaceId, taskId);
    const comments = await this.comments.listForTask(workspaceId, taskId, MAX_COMMENTS_PER_TASK);
    return comments.map(CommentMapper.toResponse);
  }

  async create(actor: Actor, workspaceId: string, taskId: string, request: CreateCommentRequest): Promise<CommentResponse> {
    const task = await this.tasksService.participants(workspaceId, taskId);
    SpaceGuard.assert(await this.tasksService.spaceIdOf(workspaceId, taskId), 'task.update');
    const created = await this.comments.create({ workspaceId, taskId, authorId: actor.userId, body: request.body.trim() });
    const { mentionIds, excerpt } = await this.mentions(actor, workspaceId, taskId, created.body);
    await this.eventBus.publish(
      domainEvent('comment', 'created', {
        workspaceId,
        entityId: created.id,
        actorId: actor.userId,
        facts: { taskId, title: task.title, assigneeId: task.assigneeId, createdById: task.createdById, watcherIds: task.watcherIds, excerpt, mentionIds },
      }),
    );
    return CommentMapper.toResponse(await this.getInWorkspace(workspaceId, created.id));
  }

  async update(actor: Actor, workspaceId: string, commentId: string, request: UpdateCommentRequest): Promise<CommentResponse> {
    const comment = await this.getInWorkspace(workspaceId, commentId);
    CommentOwnershipPolicy.assertCanEdit(comment, actor.userId);
    SpaceGuard.assert(await this.tasksService.spaceIdOf(workspaceId, comment.taskId), 'task.update');
    const before = comment.body;
    comment.body = request.body.trim();
    await this.comments.save(comment);
    const { mentionIds, excerpt } = await this.mentions(actor, workspaceId, comment.taskId, comment.body, before);
    const { title } = await this.tasksService.participants(workspaceId, comment.taskId);
    await this.eventBus.publish(domainEvent('comment', 'updated', { workspaceId, entityId: commentId, actorId: actor.userId, facts: { taskId: comment.taskId, title, excerpt, mentionIds } }));
    return CommentMapper.toResponse(await this.getInWorkspace(workspaceId, commentId));
  }

  @Announces('comment.deleted', workspaceFromAccess)
  async remove(actor: Actor, access: WorkspaceAccess, commentId: string): Promise<CommentResponse> {
    const comment = await this.getInWorkspace(access.workspaceId, commentId);
    const spaceId = await this.tasksService.spaceIdOf(access.workspaceId, comment.taskId);
    const held = new Set([...access.permissions].filter((permission) => permission !== 'task.delete' || SpaceGuard.allowed(spaceId, 'task.delete')));
    CommentOwnershipPolicy.assertCanDelete(comment, actor.userId, held);
    await this.comments.delete(access.workspaceId, commentId);
    return CommentMapper.toResponse(comment);
  }

  private async getInWorkspace(workspaceId: string, commentId: string): Promise<CommentWithAuthor> {
    return found(await this.comments.findInWorkspace(workspaceId, commentId), 'Comment');
  }
}
