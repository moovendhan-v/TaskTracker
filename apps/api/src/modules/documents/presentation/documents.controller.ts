import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { DocumentsService } from '../application/documents.service.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { DocumentQueryDto } from './dto/document-query.dto.js';
import { DocumentResponseDto, DocumentSummaryResponseDto } from './dto/document.response.dto.js';
import { MoveDocumentDto } from './dto/move-document.dto.js';
import { UpdateDocumentDto } from './dto/update-document.dto.js';

/** Edit, move and delete also need ownership or doc.manage, which DocumentAccessPolicy checks. */
@ApiTags('documents')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermissions('doc.view')
  @ApiOkResponse({ type: DocumentSummaryResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess, @Query() query: DocumentQueryDto): Promise<DocumentSummaryResponseDto[]> {
    return this.documentsService.listTree(access.workspaceId, query.search);
  }

  @Post()
  @RequirePermissions('doc.create')
  @ApiOkResponse({ type: DocumentResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.create(actor, access.workspaceId, dto);
  }

  @Get(':documentId')
  @RequirePermissions('doc.view')
  @ApiOkResponse({ type: DocumentResponseDto })
  get(@CurrentAccess() access: WorkspaceAccess, @Param('documentId', UUID_PIPE) documentId: string): Promise<DocumentResponseDto> {
    return this.documentsService.get(access.workspaceId, documentId);
  }

  @Patch(':documentId')
  @RequirePermissions('doc.view')
  @ApiOkResponse({ type: DocumentResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('documentId', UUID_PIPE) documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.update(actor, access, documentId, dto);
  }

  @Post(':documentId/move')
  @RequirePermissions('doc.view')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DocumentResponseDto })
  move(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('documentId', UUID_PIPE) documentId: string,
    @Body() dto: MoveDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.move(actor, access, documentId, dto);
  }

  @Delete(':documentId')
  @RequirePermissions('doc.view')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('documentId', UUID_PIPE) documentId: string,
  ): Promise<void> {
    return this.documentsService.remove(actor, access, documentId);
  }
}
