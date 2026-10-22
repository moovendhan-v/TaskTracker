import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../../core/time/clock.port.js';
import { LeaveRequestsService } from '../application/leave-requests.service.js';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto.js';
import { LeaveBalanceQueryDto } from './dto/leave-balance-query.dto.js';
import { LeaveBalanceResponseDto } from './dto/leave-balance.response.dto.js';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto.js';
import { LeaveRequestPageResponseDto, LeaveRequestResponseDto } from './dto/leave-request.response.dto.js';

@ApiTags('hr')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/hr')
export class LeaveRequestsController {
  constructor(
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly clock: Clock,
  ) {}

  @Get('leave-requests/mine')
  @RequirePermissions('leave.request')
  @ApiOkResponse({ type: LeaveRequestResponseDto, isArray: true })
  mine(@CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<LeaveRequestResponseDto[]> {
    return this.leaveRequestsService.mine(actor, access.workspaceId);
  }

  @Get('leave-requests')
  @RequirePermissions('leave.approve')
  @ApiOkResponse({ type: LeaveRequestPageResponseDto })
  queue(@CurrentAccess() access: WorkspaceAccess, @Query() query: LeaveRequestQueryDto): Promise<LeaveRequestPageResponseDto> {
    return this.leaveRequestsService.queue(access.workspaceId, query);
  }

  @Post('leave-requests')
  @RequirePermissions('leave.request')
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  request(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.request(actor, access.workspaceId, dto);
  }

  @Post('leave-requests/:requestId/decide')
  @RequirePermissions('leave.approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  decide(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('requestId', UUID_PIPE) requestId: string,
    @Body() dto: DecideLeaveRequestDto,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.decide(actor, access, requestId, dto);
  }

  @Post('leave-requests/:requestId/cancel')
  @RequirePermissions('leave.request')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  cancel(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('requestId', UUID_PIPE) requestId: string,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.cancel(actor, access.workspaceId, requestId);
  }

  @Get('leave-balances/mine')
  @RequirePermissions('leave.request')
  @ApiOkResponse({ type: LeaveBalanceResponseDto, isArray: true })
  myBalances(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Query() query: LeaveBalanceQueryDto,
  ): Promise<LeaveBalanceResponseDto[]> {
    return this.leaveRequestsService.myBalances(actor, access.workspaceId, query.year ?? this.clock.now().getUTCFullYear());
  }
}
