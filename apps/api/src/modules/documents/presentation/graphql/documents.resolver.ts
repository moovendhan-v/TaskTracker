import { Args, Float, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { DOC_TREE_LIMIT } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { cappedListComplexity } from '../../../../core/graphql/page.type.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { DocumentsService } from '../../application/documents.service.js';
import { CreateDocumentInput, DocumentGql, DocumentSummaryGql, DocumentTreeArgs, UpdateDocumentInput } from './document.types.js';

/** Edit, move and delete also need ownership or doc.manage, which DocumentAccessPolicy checks. */
@Resolver(() => DocumentGql)
export class DocumentsResolver {
  constructor(private readonly documentsService: DocumentsService) {}

  @Query(() => [DocumentSummaryGql], { complexity: cappedListComplexity(DOC_TREE_LIMIT), description: 'Page tree without content' })
  @RequirePermissions('doc.view')
  documents(@Args() args: DocumentTreeArgs, @CurrentAccess() access: WorkspaceAccess): Promise<DocumentSummaryGql[]> {
    return this.documentsService.listTree(access.workspaceId, args.search);
  }

  @Query(() => DocumentGql)
  @RequirePermissions('doc.view')
  document(@WorkspaceIdArg() _workspaceId: string, @UuidArg('documentId') documentId: string, @CurrentAccess() access: WorkspaceAccess): Promise<DocumentGql> {
    return this.documentsService.get(access.workspaceId, documentId);
  }

  @Mutation(() => DocumentGql)
  @RequirePermissions('doc.create')
  createDocument(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: CreateDocumentInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DocumentGql> {
    return this.documentsService.create(actor, access.workspaceId, input);
  }

  @Mutation(() => DocumentGql)
  @RequirePermissions('doc.view')
  updateDocument(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('documentId') documentId: string,
    @Args('input') input: UpdateDocumentInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DocumentGql> {
    return this.documentsService.update(actor, access, documentId, input);
  }

  @Mutation(() => DocumentGql, { description: 'parentId null moves the page to the top level' })
  @RequirePermissions('doc.view')
  moveDocument(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('documentId') documentId: string,
    @OptionalUuidArg('parentId') parentId: string | null | undefined,
    @Args('position', { type: () => Float, nullable: true }) position: number | undefined,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DocumentGql> {
    return this.documentsService.move(actor, access, documentId, { parentId: parentId ?? null, position: position ?? undefined });
  }

  @Mutation(() => Boolean, { description: 'Sub-pages are deleted too' })
  @RequirePermissions('doc.view')
  async deleteDocument(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('documentId') documentId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.documentsService.remove(actor, access, documentId);
    return true;
  }
}
