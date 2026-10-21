import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ListsService } from '../application/lists.service.js';
import { CreateTaskListDto } from './dto/create-task-list.dto.js';
import { TaskListResponseDto } from './dto/task-list.response.dto.js';
import { UpdateTaskListDto } from './dto/update-task-list.dto.js';

@ApiTags('lists')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get('lists')
  @RequirePermissions()
  @ApiOkResponse({ type: TaskListResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<TaskListResponseDto[]> {
    return this.listsService.listForWorkspace(access.workspaceId);
  }

  @Post('spaces/:spaceId/lists')
  @RequirePermissions('list.manage')
  @ApiOkResponse({ type: TaskListResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('spaceId', UUID_PIPE) spaceId: string,
    @Body() dto: CreateTaskListDto,
  ): Promise<TaskListResponseDto> {
    return this.listsService.create(actor, access.workspaceId, spaceId, dto);
  }

  @Patch('lists/:listId')
  @RequirePermissions('list.manage')
  @ApiOkResponse({ type: TaskListResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('listId', UUID_PIPE) listId: string,
    @Body() dto: UpdateTaskListDto,
  ): Promise<TaskListResponseDto> {
    return this.listsService.update(actor, access.workspaceId, listId, dto);
  }

  @Delete('lists/:listId')
  @RequirePermissions('list.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('listId', UUID_PIPE) listId: string,
  ): Promise<void> {
    return this.listsService.remove(actor, access.workspaceId, listId);
  }
}
