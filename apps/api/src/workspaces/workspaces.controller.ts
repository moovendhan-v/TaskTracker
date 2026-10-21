import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { CurrentActor } from '../common/decorators/actor.decorator.js';
import { RequirePermissions } from '../access/require-permissions.decorator.js';
import { CurrentAccess } from '../access/workspace-access.decorator.js';
import { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceDto } from './dto/workspace.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@ApiTags('workspaces')
@ApiCookieAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @ApiOkResponse({ type: WorkspaceDto, isArray: true })
  list(@CurrentActor() actor: Actor): Promise<WorkspaceDto[]> {
    return this.workspacesService.listForUser(actor.userId);
  }

  @Post()
  @ApiOkResponse({ type: WorkspaceDto })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateWorkspaceDto): Promise<WorkspaceDto> {
    return this.workspacesService.create(actor, dto);
  }

  @Get(':workspaceId')
  @RequirePermissions()
  @ApiOkResponse({ type: WorkspaceDto })
  get(@CurrentAccess() access: WorkspaceAccess): Promise<WorkspaceDto> {
    return this.workspacesService.get(access);
  }

  @Patch(':workspaceId')
  @RequirePermissions('workspace.manage')
  @ApiOkResponse({ type: WorkspaceDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    return this.workspacesService.update(actor, access, dto);
  }

  @Delete(':workspaceId')
  @RequirePermissions('workspace.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<void> {
    return this.workspacesService.remove(actor, access);
  }
}
