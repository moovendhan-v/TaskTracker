import { Injectable } from '@nestjs/common';
import { TASK_ATTACHMENTS_MAX, TASK_UPLOAD_MAX_BYTES, type TaskAttachmentResponse, type TaskUploadResult, type TaskUploadTicket } from '@taskflow/shared-types';
import { randomUUID } from 'node:crypto';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { domainEvent, type ChangeKind } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { FileStorage } from '../../../core/storage/file-storage.port.js';
import { cleanFileName, isAllowedExtension } from '../../../core/storage/file-types.js';
import { StorageTokens } from '../../../core/storage/storage-tokens.js';
import { FileScanner } from '../../../core/scanning/file-scanner.port.js';
import { deleteUpload, downloadUrl, inspectUpload, thumbnailKey, UPLOAD_REFUSALS, uploadUrl } from '../../../core/storage/upload-checks.js';
import { TaskAttachmentRepository, type TaskAttachmentRecord } from '../domain/task-attachment.repository.js';

const STALE_UPLOAD_MS = 24 * 60 * 60_000;
const PENDING_UPLOADS_MAX = 20;

/**
 * Files on tasks, on the same private storage and checks as chat files: a short-lived
 * same-origin upload link, then the real type from the file's first bytes. Seeing them
 * follows the task (row-level security); adding needs task.update in the task's space;
 * removing is for the uploader or anyone who may delete tasks there.
 */
@Injectable()
export class TaskAttachmentsService {
  constructor(
    private readonly attachments: TaskAttachmentRepository,
    private readonly storage: FileStorage,
    private readonly tokens: StorageTokens,
    private readonly events: EventBus,
    private readonly scanner: FileScanner,
  ) {}

  async list(access: WorkspaceAccess, taskId: string): Promise<TaskAttachmentResponse[]> {
    await this.taskSpace(access, taskId);
    return (await this.attachments.list(access.workspaceId, taskId)).map((file) => this.toResponse(file));
  }

  async request(actor: Actor, access: WorkspaceAccess, input: { taskId: string; fileName: string; size: number }): Promise<TaskUploadTicket> {
    const spaceId = await this.taskSpace(access, input.taskId);
    SpaceGuard.assert(spaceId, 'task.update');
    const fileName = cleanFileName(input.fileName);
    if (!isAllowedExtension(fileName)) throw DomainError.invalid('Images, PDFs, Office files, zip and text files only');
    if (!Number.isInteger(input.size) || input.size <= 0 || input.size > TASK_UPLOAD_MAX_BYTES) throw DomainError.invalid('Files can be up to 10 MB');
    for (const stale of await this.attachments.stale(access.workspaceId, actor.userId, new Date(Date.now() - STALE_UPLOAD_MS))) await this.removeFile(access, stale);
    if ((await this.attachments.countPending(access.workspaceId, actor.userId)) >= PENDING_UPLOADS_MAX) throw DomainError.invalid('Finish the uploads you started first');
    if ((await this.attachments.countOnTask(access.workspaceId, input.taskId)) >= TASK_ATTACHMENTS_MAX) throw DomainError.invalid(`A task can have at most ${TASK_ATTACHMENTS_MAX} files`);
    const storageKey = `w/${access.workspaceId}/tasks/${randomUUID()}`;
    const attachmentId = await this.attachments.insert({ workspaceId: access.workspaceId, taskId: input.taskId, uploaderId: actor.userId, fileName, declaredSize: input.size, storageKey });
    return { attachmentId, uploadUrl: uploadUrl(this.tokens, storageKey, input.size), maxBytes: input.size };
  }

  /** Checks what arrived. A refused file is deleted and the reason returned (not thrown), so the deletion commits. */
  async complete(actor: Actor, access: WorkspaceAccess, attachmentId: string): Promise<TaskUploadResult> {
    const file = await this.own(actor, access, attachmentId);
    if (file.status === 'ready') return { attachment: this.toResponse(file), error: null };
    const checked = await inspectUpload(this.storage, this.scanner, file.storageKey, file.declaredSize, file.fileName);
    if (checked === 'missing') throw DomainError.invalid("The file hasn't been uploaded yet");
    if (typeof checked === 'string') {
      await this.removeFile(access, file);
      return { attachment: null, error: UPLOAD_REFUSALS[checked] };
    }
    await this.attachments.markReady(access.workspaceId, file.id, checked.contentType, checked.size, checked.thumbnail);
    await this.announce(actor, access, file.taskId, 'created');
    return { attachment: this.toResponse({ ...file, status: 'ready', contentType: checked.contentType, size: checked.size, hasThumbnail: checked.thumbnail }), error: null };
  }

  async remove(actor: Actor, access: WorkspaceAccess, attachmentId: string): Promise<boolean> {
    const file = await this.attachments.find(access.workspaceId, attachmentId);
    if (!file) throw DomainError.notFound('File');
    const spaceId = await this.taskSpace(access, file.taskId);
    const mayDeleteAny = access.permissions.has('task.delete') && SpaceGuard.allowed(spaceId, 'task.delete');
    if (file.uploaderId !== actor.userId && !mayDeleteAny) throw DomainError.forbidden('Only the person who added a file, or someone who may delete tasks, can remove it');
    await this.removeFile(access, file);
    if (file.status === 'ready') await this.announce(actor, access, file.taskId, 'deleted');
    return true;
  }

  private async own(actor: Actor, access: WorkspaceAccess, attachmentId: string): Promise<TaskAttachmentRecord> {
    const file = await this.attachments.find(access.workspaceId, attachmentId);
    if (!file || file.uploaderId !== actor.userId) throw DomainError.notFound('File');
    return file;
  }

  /** The task's space; a task you can't see is not found. */
  private async taskSpace(access: WorkspaceAccess, taskId: string): Promise<string> {
    const spaceId = await this.attachments.taskSpace(access.workspaceId, taskId);
    if (!spaceId) throw DomainError.notFound('Task');
    return spaceId;
  }

  private async removeFile(access: WorkspaceAccess, file: TaskAttachmentRecord): Promise<void> {
    await this.attachments.remove(access.workspaceId, file.id);
    await deleteUpload(this.storage, file.storageKey);
  }

  private toResponse(file: TaskAttachmentRecord): TaskAttachmentResponse {
    const contentType = file.contentType ?? 'application/octet-stream';
    return {
      id: file.id,
      taskId: file.taskId,
      fileName: file.fileName,
      contentType,
      size: file.size ?? file.declaredSize,
      isImage: contentType.startsWith('image/'),
      url: downloadUrl(this.tokens, file.storageKey, contentType, file.fileName),
      thumbnailUrl: file.hasThumbnail ? downloadUrl(this.tokens, thumbnailKey(file.storageKey), 'image/webp', `${file.fileName}.webp`) : null,
      uploaderId: file.uploaderId,
      uploaderName: file.uploaderName,
      createdAt: file.createdAt.toISOString(),
    };
  }

  /** Ids only, like every live event: viewers refetch the list through this API. */
  private announce(actor: Actor, access: WorkspaceAccess, taskId: string, change: ChangeKind): Promise<void> {
    return this.events.publish(domainEvent('task_attachment', change, { workspaceId: access.workspaceId, entityId: taskId, actorId: actor.userId }));
  }
}
