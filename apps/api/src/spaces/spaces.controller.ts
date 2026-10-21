import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { CurrentActor } from '../common/decorators/actor.decorator.js';
import { UUID_PIPE } from '../common/http/id-params.js';
import { RequirePermissions } from '../access/require-permissions.decorator.js';
import { CurrentAccess } from '../access/workspace-access.decorator.js';
import { CreateSpaceDto, SpaceDto, UpdateSpaceDto } from './dto/space.dto.js';
import { SpacesService } from './spaces.service.js';

@ApiTags('spaces')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  @RequirePermissions()
  @ApiOkResponse({ type: SpaceDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<SpaceDto[]> {
    return this.spacesService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('space.manage')
  @ApiOkResponse({ type: SpaceDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateSpaceDto,
  ): Promise<SpaceDto> {
    return this.spacesService.create(actor, access.workspaceId, dto);
  }

  @Patch(':spaceId')
  @RequirePermissions('space.manage')
  @ApiOkResponse({ type: SpaceDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('spaceId', UUID_PIPE) spaceId: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceDto> {
    return this.spacesService.update(actor, access.workspaceId, spaceId, dto);
  }

  @Delete(':spaceId')
  @RequirePermissions('space.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('spaceId', UUID_PIPE) spaceId: string,
  ): Promise<void> {
    return this.spacesService.remove(actor, access.workspaceId, spaceId);
  }
}
