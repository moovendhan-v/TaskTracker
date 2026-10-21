import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { CurrentActor } from '../common/decorators/actor.decorator.js';
import { UUID_PIPE } from '../common/http/id-params.js';
import { RequirePermissions } from '../access/require-permissions.decorator.js';
import { CurrentAccess } from '../access/workspace-access.decorator.js';
import { CreateTaskListDto, TaskListDto, UpdateTaskListDto } from './dto/task-list.dto.js';
import { ListsService } from './lists.service.js';

@ApiTags('lists')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get('lists')
  @RequirePermissions()
  @ApiOkResponse({ type: TaskListDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<TaskListDto[]> {
    return this.listsService.listForWorkspace(access.workspaceId);
  }

  @Post('spaces/:spaceId/lists')
  @RequirePermissions('list.manage')
  @ApiOkResponse({ type: TaskListDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('spaceId', UUID_PIPE) spaceId: string,
    @Body() dto: CreateTaskListDto,
  ): Promise<TaskListDto> {
    return this.listsService.create(actor, access.workspaceId, spaceId, dto);
  }

  @Patch('lists/:listId')
  @RequirePermissions('list.manage')
  @ApiOkResponse({ type: TaskListDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('listId', UUID_PIPE) listId: string,
    @Body() dto: UpdateTaskListDto,
  ): Promise<TaskListDto> {
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
