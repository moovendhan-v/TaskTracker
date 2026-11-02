import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { TaskAttachmentsService } from '../../application/task-attachments.service.js';
import { RequestTaskUploadInput, TaskAttachmentGql, TaskUploadResultGql, TaskUploadTicketGql } from './task-attachment.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** Files on tasks. Seeing them needs task.view (and the task); adding needs task.update in its space. */
@Resolver(() => TaskAttachmentGql)
export class TaskAttachmentsResolver {
  constructor(private readonly service: TaskAttachmentsService) {}

  @Query(() => [TaskAttachmentGql])
  @RequirePermissions('task.view')
  taskAttachments(@WorkspaceIdArg() _w: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskAttachmentGql[]> {
    return this.service.list(access, taskId);
  }

  @Mutation(() => TaskUploadTicketGql, { description: 'Starts a file upload to a task: returns a short-lived URL to PUT the bytes to' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(20))
  requestTaskUpload(@WorkspaceIdArg() _w: string, @Args('input') input: RequestTaskUploadInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TaskUploadTicketGql> {
    return this.service.request(actor, access, input);
  }

  @Mutation(() => TaskUploadResultGql, { description: 'Checks an uploaded file (size, real type). Files that fail are deleted and the reason returned' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(20))
  completeTaskUpload(@WorkspaceIdArg() _w: string, @UuidArg('attachmentId') attachmentId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TaskUploadResultGql> {
    return this.service.complete(actor, access, attachmentId);
  }

  @Mutation(() => Boolean, { description: 'Removes a file: its uploader, or someone who may delete tasks in that space' })
  @RequirePermissions('task.view')
  deleteTaskAttachment(@WorkspaceIdArg() _w: string, @UuidArg('attachmentId') attachmentId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.remove(actor, access, attachmentId);
  }
}
