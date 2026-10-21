import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { SpacesService } from '../application/spaces.service.js';
import { CreateSpaceDto } from './dto/create-space.dto.js';
import { SpaceResponseDto } from './dto/space.response.dto.js';
import { UpdateSpaceDto } from './dto/update-space.dto.js';

@ApiTags('spaces')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  @RequirePermissions()
  @ApiOkResponse({ type: SpaceResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<SpaceResponseDto[]> {
    return this.spacesService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('space.manage')
  @ApiOkResponse({ type: SpaceResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateSpaceDto,
  ): Promise<SpaceResponseDto> {
    return this.spacesService.create(actor, access.workspaceId, dto);
  }

  @Patch(':spaceId')
  @RequirePermissions('space.manage')
  @ApiOkResponse({ type: SpaceResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('spaceId', UUID_PIPE) spaceId: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceResponseDto> {
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
