import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { WorkspacesService } from '../application/workspaces.service.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { WorkspaceResponseDto } from './dto/workspace.response.dto.js';

@ApiTags('workspaces')
@ApiCookieAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @ApiOkResponse({ type: WorkspaceResponseDto, isArray: true })
  list(@CurrentActor() actor: Actor): Promise<WorkspaceResponseDto[]> {
    return this.workspacesService.listForUser(actor.userId);
  }

  @Post()
  @ApiOkResponse({ type: WorkspaceResponseDto })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateWorkspaceDto): Promise<WorkspaceResponseDto> {
    return this.workspacesService.create(actor, dto);
  }

  @Get(':workspaceId')
  @RequirePermissions()
  @ApiOkResponse({ type: WorkspaceResponseDto })
  get(@CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<WorkspaceResponseDto> {
    return this.workspacesService.get(access, actor.userId);
  }

  @Patch(':workspaceId')
  @RequirePermissions('workspace.manage')
  @ApiOkResponse({ type: WorkspaceResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.update(actor, access, dto);
  }

  @Delete(':workspaceId')
  @RequirePermissions('workspace.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<void> {
    return this.workspacesService.remove(actor, access);
  }
}
