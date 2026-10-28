import { Injectable } from '@nestjs/common';
import {
  DOC_TREE_LIMIT,
  isSpaceScoped,
  type Permission,
  type CreateDocumentRequest,
  type DocumentResponse,
  type DocumentSummaryResponse,
  type MoveDocumentRequest,
  type UpdateDocumentRequest,
} from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess, workspaceFromArg } from '../../../core/runtime/change-target.js';
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
  ) {}

  @Cached({ entities: ['document'], shared: true })
  async listTree(workspaceId: string, search?: string): Promise<DocumentSummaryResponse[]> {
    const documents = await this.documents.listSummaries(workspaceId, DOC_TREE_LIMIT, search?.trim() || undefined);
    return documents.map(DocumentMapper.toSummary);
  }

  async get(workspaceId: string, documentId: string): Promise<DocumentResponse> {
    return DocumentMapper.toResponse(await this.getInWorkspace(workspaceId, documentId));
  }

  @Announces('document.created', workspaceFromArg)
  async create(actor: Actor, workspaceId: string, request: CreateDocumentRequest): Promise<DocumentResponse> {
    const document = await this.unitOfWork.run(async () => {
      const parentId = request.parentId ?? null;
      const kind = request.kind ?? 'page';
      const parent = parentId ? await this.getInWorkspace(workspaceId, parentId) : null;
      const parentChain = parent ? await this.documents.ancestorChain(workspaceId, parent.id) : [];
      DocumentTreePolicy.assertValidPlacement({ kind, parentKind: parent?.kind, parentChain, subtreeHeight: 1 });

      // A child page always lives in its parent's space.
      const spaceId = parent ? parent.spaceId : (request.spaceId ?? null);
      if (spaceId && !parent) await this.spacesService.getInWorkspace(workspaceId, spaceId);
      if (spaceId) SpaceGuard.assert(spaceId, 'doc.create');

      return this.documents.create({
        workspaceId,
        spaceId,
        parentId,
        kind,
        title: request.title.trim(),
        icon: request.icon ?? null,
        content: kind === 'folder' ? '' : this.sanitizer.sanitize(request.content ?? ''),
        position: (await this.documents.maxSiblingPosition(workspaceId, parentId)) + DOC_POSITION_STEP,
        createdById: actor.userId,
        updatedById: actor.userId,
      });
    });
    return DocumentMapper.toResponse(document);
  }

  @Announces('document.updated', workspaceFromAccess)
  async update(actor: Actor, access: WorkspaceAccess, documentId: string, request: UpdateDocumentRequest): Promise<DocumentResponse> {
    const document = await this.getInWorkspace(access.workspaceId, documentId);
    DocumentAccessPolicy.assertCanEdit(document, actor.userId, inSpace(access.permissions, document.spaceId));

    if (request.title !== undefined) document.title = request.title.trim();
    if (request.icon !== undefined) document.icon = request.icon;
    if (request.content !== undefined) {
      if (document.kind === 'folder') throw DomainError.invalid('A folder has no content');
      document.content = this.sanitizer.sanitize(request.content);
    }
    document.updatedById = actor.userId;
    return DocumentMapper.toResponse(await this.documents.save(document));
  }

  @Announces('document.updated', workspaceFromAccess)
  async move(actor: Actor, access: WorkspaceAccess, documentId: string, request: MoveDocumentRequest): Promise<DocumentResponse> {
    const moved = await this.unitOfWork.run(async () => {
      const document = await this.getInWorkspace(access.workspaceId, documentId);
      DocumentAccessPolicy.assertCanEdit(document, actor.userId, inSpace(access.permissions, document.spaceId));

      const parent = request.parentId ? await this.getInWorkspace(access.workspaceId, request.parentId) : null;
      const parentChain = parent ? await this.documents.ancestorChain(access.workspaceId, parent.id) : [];
      DocumentTreePolicy.assertValidPlacement({
        kind: document.kind,
        parentKind: parent?.kind,
        documentId,
        parentChain,
        subtreeHeight: await this.documents.subtreeHeight(access.workspaceId, documentId),
      });

      document.parentId = parent?.id ?? null;
      // A page lives in its parent's space; a top-level page can be given one (or taken out of it with null).
      const spaceId = parent ? parent.spaceId : request.spaceId === undefined ? document.spaceId : request.spaceId;
      if (spaceId && !parent && spaceId !== document.spaceId) await this.spacesService.getInWorkspace(access.workspaceId, spaceId);
      if (spaceId && spaceId !== document.spaceId) SpaceGuard.assert(spaceId, 'doc.create');
      if (spaceId !== document.spaceId) await this.documents.setSubtreeSpace(access.workspaceId, documentId, spaceId);
      document.spaceId = spaceId;
      document.position =
        request.position ?? (await this.documents.maxSiblingPosition(access.workspaceId, document.parentId)) + DOC_POSITION_STEP;
      document.updatedById = actor.userId;
      return this.documents.save(document);
    });
    return DocumentMapper.toResponse(moved);
  }

  @Audited('document.delete', { ...workspaceFromAccess, metadata: (document: DocumentResponse) => ({ title: document.title }) })
  @Announces('document.deleted', workspaceFromAccess)
  async remove(actor: Actor, access: WorkspaceAccess, documentId: string): Promise<DocumentResponse> {
    const document = await this.getInWorkspace(access.workspaceId, documentId);
    DocumentAccessPolicy.assertCanEdit(document, actor.userId, inSpace(access.permissions, document.spaceId));
    await this.documents.delete(access.workspaceId, documentId);
    return DocumentMapper.toResponse(document);
  }

  private async getInWorkspace(workspaceId: string, documentId: string): Promise<Document> {
    return found(await this.documents.findInWorkspace(workspaceId, documentId), 'Page');
  }
}

/** The permissions that still hold inside a doc's space, after the caller's space limits. */
function inSpace(held: ReadonlySet<Permission>, spaceId: string | null): ReadonlySet<Permission> {
  if (!spaceId) return held;
  return new Set([...held].filter((permission) => !isSpaceScoped(permission) || SpaceGuard.allowed(spaceId, permission)));
}
