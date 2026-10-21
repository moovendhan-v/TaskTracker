import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { CurrentActor } from '../common/decorators/actor.decorator.js';
import { RequirePermissions } from '../access/require-permissions.decorator.js';
import { CurrentAccess } from '../access/workspace-access.decorator.js';
import { AddMemberDto, AddMemberResultDto, MemberDto, UpdateMemberRoleDto } from './dto/member.dto.js';
import { MembersService } from './members.service.js';

@ApiTags('members')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequirePermissions()
  @ApiOkResponse({ type: MemberDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<MemberDto[]> {
    return this.membersService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('members.manage')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: AddMemberResultDto })
  add(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: AddMemberDto,
  ): Promise<AddMemberResultDto> {
    return this.membersService.add(actor, access, dto);
  }

  @Patch(':userId')
  @RequirePermissions('members.manage')
  @ApiOkResponse({ type: MemberDto })
  updateRole(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberDto> {
    return this.membersService.updateRole(actor, access, userId, dto);
  }

  @Delete(':userId')
  @RequirePermissions('members.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.membersService.remove(actor, access, userId);
  }

  /** Any member may leave; the last owner is still blocked by the service. */
  @Post('leave')
  @RequirePermissions()
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<void> {
    return this.membersService.remove(actor, access, actor.userId);
  }
}
