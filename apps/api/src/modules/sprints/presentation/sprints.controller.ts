import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { SprintsService } from '../application/sprints.service.js';
import { CompleteSprintDto } from './dto/complete-sprint.dto.js';
import { CreateSprintDto } from './dto/create-sprint.dto.js';
import { SprintResponseDto } from './dto/sprint.response.dto.js';
import { UpdateSprintDto } from './dto/update-sprint.dto.js';

@ApiTags('sprints')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get('spaces/:spaceId/sprints')
  @RequirePermissions('task.view')
  @ApiOkResponse({ type: SprintResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess, @Param('spaceId', UUID_PIPE) spaceId: string): Promise<SprintResponseDto[]> {
    return this.sprintsService.listInSpace(access.workspaceId, spaceId);
  }

  @Post('spaces/:spaceId/sprints')
  @RequirePermissions('sprint.manage')
  @ApiOkResponse({ type: SprintResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('spaceId', UUID_PIPE) spaceId: string,
    @Body() dto: CreateSprintDto,
  ): Promise<SprintResponseDto> {
    return this.sprintsService.create(actor, access.workspaceId, spaceId, dto);
  }

  @Get('sprints/:sprintId')
  @RequirePermissions('task.view')
  @ApiOkResponse({ type: SprintResponseDto })
  get(@CurrentAccess() access: WorkspaceAccess, @Param('sprintId', UUID_PIPE) sprintId: string): Promise<SprintResponseDto> {
    return this.sprintsService.get(access.workspaceId, sprintId);
  }

  @Patch('sprints/:sprintId')
  @RequirePermissions('sprint.manage')
  @ApiOkResponse({ type: SprintResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('sprintId', UUID_PIPE) sprintId: string,
    @Body() dto: UpdateSprintDto,
  ): Promise<SprintResponseDto> {
    return this.sprintsService.update(actor, access.workspaceId, sprintId, dto);
  }

  @Delete('sprints/:sprintId')
  @RequirePermissions('sprint.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('sprintId', UUID_PIPE) sprintId: string,
  ): Promise<void> {
    return this.sprintsService.remove(actor, access.workspaceId, sprintId);
  }

  @Post('sprints/:sprintId/start')
  @RequirePermissions('sprint.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SprintResponseDto })
  start(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('sprintId', UUID_PIPE) sprintId: string,
  ): Promise<SprintResponseDto> {
    return this.sprintsService.start(actor, access.workspaceId, sprintId);
  }

  @Post('sprints/:sprintId/complete')
  @RequirePermissions('sprint.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SprintResponseDto })
  complete(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('sprintId', UUID_PIPE) sprintId: string,
    @Body() dto: CompleteSprintDto,
  ): Promise<SprintResponseDto> {
    return this.sprintsService.complete(actor, access.workspaceId, sprintId, dto);
  }
}
