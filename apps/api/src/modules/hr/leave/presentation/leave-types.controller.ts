import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { LeaveTypesService } from '../application/leave-types.service.js';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto.js';
import { LeaveTypeResponseDto } from './dto/leave-type.response.dto.js';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto.js';

@ApiTags('hr')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/hr/leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  /** Anyone who can request leave needs to see the types. */
  @Get()
  @RequirePermissions()
  @ApiOkResponse({ type: LeaveTypeResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<LeaveTypeResponseDto[]> {
    return this.leaveTypesService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('hr.manage')
  @ApiOkResponse({ type: LeaveTypeResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    return this.leaveTypesService.create(actor, access.workspaceId, dto);
  }

  @Patch(':leaveTypeId')
  @RequirePermissions('hr.manage')
  @ApiOkResponse({ type: LeaveTypeResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('leaveTypeId', UUID_PIPE) leaveTypeId: string,
    @Body() dto: UpdateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    return this.leaveTypesService.update(actor, access.workspaceId, leaveTypeId, dto);
  }

  @Delete(':leaveTypeId')
  @RequirePermissions('hr.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('leaveTypeId', UUID_PIPE) leaveTypeId: string,
  ): Promise<void> {
    return this.leaveTypesService.remove(actor, access.workspaceId, leaveTypeId);
  }
}
