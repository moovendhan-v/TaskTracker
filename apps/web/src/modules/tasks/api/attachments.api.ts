import type { TaskAttachmentResponse } from '@taskflow/shared-types';
import { AddChecklistItemDocument, CompleteTaskUploadDocument, DeleteChecklistItemDocument, DeleteTaskAttachmentDocument, MoveChecklistItemDocument, RequestTaskUploadDocument, TaskAttachmentsDocument, TaskChecklistDocument, UpdateChecklistItemDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';
import { uploadWith } from '@/lib/upload';

export const attachmentsApi = {
  list: async (workspaceId: string, taskId: string): Promise<TaskAttachmentResponse[]> => (await graphql(TaskAttachmentsDocument, { workspaceId, taskId })).taskAttachments,
  remove: async (workspaceId: string, attachmentId: string) => (await graphql(DeleteTaskAttachmentDocument, { workspaceId, attachmentId })).deleteTaskAttachment,
  /** Ask for a link, send the bytes, then let the server check them. */
  upload: (workspaceId: string, taskId: string, file: File, onProgress: (fraction: number) => void) =>
    uploadWith<TaskAttachmentResponse>(
      {
        request: async () => (await graphql(RequestTaskUploadDocument, { workspaceId, input: { taskId, fileName: file.name, size: file.size } })).requestTaskUpload,
        complete: async (attachmentId) => (await graphql(CompleteTaskUploadDocument, { workspaceId, attachmentId })).completeTaskUpload,
        discard: (attachmentId) => graphql(DeleteTaskAttachmentDocument, { workspaceId, attachmentId }),
      },
      file,
      onProgress,
    ),
};

/** A task's checklist (C2). */
export const checklistApi = {
  list: async (workspaceId: string, taskId: string) => (await graphql(TaskChecklistDocument, { workspaceId, taskId })).taskChecklist,
  add: async (workspaceId: string, taskId: string, title: string) => (await graphql(AddChecklistItemDocument, { workspaceId, taskId, title })).addChecklistItem,
  update: async (workspaceId: string, itemId: string, input: { title?: string; done?: boolean }) => (await graphql(UpdateChecklistItemDocument, { workspaceId, itemId, input })).updateChecklistItem,
  move: async (workspaceId: string, itemId: string, beforeId: string | null) => (await graphql(MoveChecklistItemDocument, { workspaceId, itemId, beforeId })).moveChecklistItem,
  remove: async (workspaceId: string, itemId: string) => (await graphql(DeleteChecklistItemDocument, { workspaceId, itemId })).deleteChecklistItem,
};
