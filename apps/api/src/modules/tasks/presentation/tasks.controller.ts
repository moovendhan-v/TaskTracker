import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { TasksService } from '../application/tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { TaskPageResponseDto } from './dto/task-page.response.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { TaskResponseDto } from './dto/task.response.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

@ApiTags('tasks')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('lists/:listId/tasks')
  @RequirePermissions('task.view')
  @ApiOkResponse({ type: TaskPageResponseDto })
  list(
    @CurrentAccess() access: WorkspaceAccess,
    @Param('listId', UUID_PIPE) listId: string,
    @Query() query: TaskQueryDto,
  ): Promise<TaskPageResponseDto> {
    return this.tasksService.listInList(access.workspaceId, listId, query);
  }

  @Post('lists/:listId/tasks')
  @RequirePermissions('task.create')
  @ApiOkResponse({ type: TaskResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('listId', UUID_PIPE) listId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(actor, access, listId, dto);
  }

  @Get('tasks/:taskId')
  @RequirePermissions('task.view')
  @ApiOkResponse({ type: TaskResponseDto })
  get(@CurrentAccess() access: WorkspaceAccess, @Param('taskId', UUID_PIPE) taskId: string): Promise<TaskResponseDto> {
    return this.tasksService.get(access.workspaceId, taskId);
  }

  @Patch('tasks/:taskId')
  @RequirePermissions('task.update')
  @ApiOkResponse({ type: TaskResponseDto })
  update(
    @CurrentAccess() access: WorkspaceAccess,
    @Param('taskId', UUID_PIPE) taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(access, taskId, dto);
  }

  @Delete('tasks/:taskId')
  @RequirePermissions('task.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAccess() access: WorkspaceAccess, @Param('taskId', UUID_PIPE) taskId: string): Promise<void> {
    return this.tasksService.remove(access.workspaceId, taskId);
  }
}
