import { Injectable } from '@nestjs/common';
import {
  DOC_TREE_LIMIT,
  type CreateDocumentRequest,
  type DocumentResponse,
  type DocumentSummaryResponse,
  type MoveDocumentRequest,
  type UpdateDocumentRequest,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { ContentSanitizer } from '../domain/content-sanitizer.port.js';
import { DOC_POSITION_STEP, type Document } from '../domain/document.js';
import { DocumentAccessPolicy } from '../domain/document-access.policy.js';
import { DocumentTreePolicy } from '../domain/document-tree.policy.js';
import { DocumentRepository } from '../domain/document.repository.js';
import { DocumentMapper } from './document.mapper.js';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly sanitizer: ContentSanitizer,
    private readonly spacesService: SpacesService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
  ) {}

  async listTree(workspaceId: string, search?: string): Promise<DocumentSummaryResponse[]> {
    const documents = await this.documents.listSummaries(workspaceId, DOC_TREE_LIMIT, search?.trim() || undefined);
    return documents.map(DocumentMapper.toSummary);
  }

  async get(workspaceId: string, documentId: string): Promise<DocumentResponse> {
    return DocumentMapper.toResponse(await this.getInWorkspace(workspaceId, documentId));
  }

  async create(actor: Actor, workspaceId: string, request: CreateDocumentRequest): Promise<DocumentResponse> {
    const document = await this.unitOfWork.run(async () => {
      const parentId = request.parentId ?? null;
      const parent = parentId ? await this.getInWorkspace(workspaceId, parentId) : null;
      const parentChain = parent ? await this.documents.ancestorChain(workspaceId, parent.id) : [];
      DocumentTreePolicy.assertValidPlacement({ parentChain, subtreeHeight: 1 });

      // A child page always lives in its parent's space.
      const spaceId = parent ? parent.spaceId : (request.spaceId ?? null);
      if (spaceId && !parent) await this.spacesService.getInWorkspace(workspaceId, spaceId);

      return this.documents.create({
        workspaceId,
        spaceId,
        parentId,
        title: request.title.trim(),
        content: this.sanitizer.sanitize(request.content ?? ''),
        position: (await this.documents.maxSiblingPosition(workspaceId, parentId)) + DOC_POSITION_STEP,
        createdById: actor.userId,
        updatedById: actor.userId,
      });
    });
    return DocumentMapper.toResponse(document);
  }

  async update(actor: Actor, access: WorkspaceAccess, documentId: string, request: UpdateDocumentRequest): Promise<DocumentResponse> {
    const document = await this.getInWorkspace(access.workspaceId, documentId);
    DocumentAccessPolicy.assertCanEdit(document, actor.userId, access.permissions);

    if (request.title !== undefined) document.title = request.title.trim();
    if (request.content !== undefined) document.content = this.sanitizer.sanitize(request.content);
    document.updatedById = actor.userId;
    return DocumentMapper.toResponse(await this.documents.save(document));
  }

  async move(actor: Actor, access: WorkspaceAccess, documentId: string, request: MoveDocumentRequest): Promise<DocumentResponse> {
    const moved = await this.unitOfWork.run(async () => {
      const document = await this.getInWorkspace(access.workspaceId, documentId);
      DocumentAccessPolicy.assertCanEdit(document, actor.userId, access.permissions);

      const parent = request.parentId ? await this.getInWorkspace(access.workspaceId, request.parentId) : null;
      const parentChain = parent ? await this.documents.ancestorChain(access.workspaceId, parent.id) : [];
      DocumentTreePolicy.assertValidPlacement({
        documentId,
        parentChain,
        subtreeHeight: await this.documents.subtreeHeight(access.workspaceId, documentId),
      });

      document.parentId = parent?.id ?? null;
      if (parent) document.spaceId = parent.spaceId;
      document.position =
        request.position ?? (await this.documents.maxSiblingPosition(access.workspaceId, document.parentId)) + DOC_POSITION_STEP;
      document.updatedById = actor.userId;
      return this.documents.save(document);
    });
    return DocumentMapper.toResponse(moved);
  }

  async remove(actor: Actor, access: WorkspaceAccess, documentId: string): Promise<void> {
    const document = await this.getInWorkspace(access.workspaceId, documentId);
    DocumentAccessPolicy.assertCanEdit(document, actor.userId, access.permissions);
    await this.unitOfWork.run(async () => {
      await this.documents.delete(access.workspaceId, documentId);
      await this.auditLogger.record(actor, {
        action: 'document.delete',
        targetType: 'document',
        targetId: documentId,
        workspaceId: access.workspaceId,
        metadata: { title: document.title },
      });
    });
  }

  private async getInWorkspace(workspaceId: string, documentId: string): Promise<Document> {
    const document = await this.documents.findInWorkspace(workspaceId, documentId);
    if (!document) throw DomainError.notFound('Page');
    return document;
  }
}
