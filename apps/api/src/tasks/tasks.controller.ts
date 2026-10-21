import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { CurrentActor } from '../common/decorators/actor.decorator.js';
import { UUID_PIPE } from '../common/http/id-params.js';
import { RequirePermissions } from '../access/require-permissions.decorator.js';
import { CurrentAccess } from '../access/workspace-access.decorator.js';
import { CreateTaskDto, TaskDto, TaskPageDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('lists/:listId/tasks')
  @RequirePermissions('task.view')
  @ApiOkResponse({ type: TaskPageDto })
  list(
    @CurrentAccess() access: WorkspaceAccess,
    @Param('listId', UUID_PIPE) listId: string,
    @Query() query: TaskQueryDto,
  ): Promise<TaskPageDto> {
    return this.tasksService.listInList(access.workspaceId, listId, query);
  }

  @Post('lists/:listId/tasks')
  @RequirePermissions('task.create')
  @ApiOkResponse({ type: TaskDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('listId', UUID_PIPE) listId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDto> {
    return this.tasksService.create(actor, access, listId, dto);
  }

  @Get('tasks/:taskId')
  @RequirePermissions('task.view')
  @ApiOkResponse({ type: TaskDto })
  get(@CurrentAccess() access: WorkspaceAccess, @Param('taskId', UUID_PIPE) taskId: string): Promise<TaskDto> {
    return this.tasksService.get(access.workspaceId, taskId);
  }

  @Patch('tasks/:taskId')
  @RequirePermissions('task.update')
  @ApiOkResponse({ type: TaskDto })
  update(
    @CurrentAccess() access: WorkspaceAccess,
    @Param('taskId', UUID_PIPE) taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasksService.update(access, taskId, dto);
  }

  @Delete('tasks/:taskId')
  @RequirePermissions('task.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAccess() access: WorkspaceAccess, @Param('taskId', UUID_PIPE) taskId: string): Promise<void> {
    return this.tasksService.remove(access.workspaceId, taskId);
  }
}
