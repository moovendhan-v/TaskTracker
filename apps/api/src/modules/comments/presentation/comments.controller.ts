import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { CommentsService } from '../application/comments.service.js';
import { CommentResponseDto } from './dto/comment.response.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';

@ApiTags('comments')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('tasks/:taskId/comments')
  @RequirePermissions('task.view')
  @ApiOkResponse({ type: CommentResponseDto, isArray: true })
  list(
    @CurrentAccess() access: WorkspaceAccess,
    @Param('taskId', UUID_PIPE) taskId: string,
  ): Promise<CommentResponseDto[]> {
    return this.commentsService.list(access.workspaceId, taskId);
  }

  @Post('tasks/:taskId/comments')
  @RequirePermissions('task.update')
  @ApiOkResponse({ type: CommentResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('taskId', UUID_PIPE) taskId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(actor, access.workspaceId, taskId, dto);
  }

  @Patch('comments/:commentId')
  @RequirePermissions('task.update')
  @ApiOkResponse({ type: CommentResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('commentId', UUID_PIPE) commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.update(actor, access.workspaceId, commentId, dto);
  }

  @Delete('comments/:commentId')
  @RequirePermissions('task.view')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('commentId', UUID_PIPE) commentId: string,
  ): Promise<void> {
    return this.commentsService.remove(actor, access, commentId);
  }
}
