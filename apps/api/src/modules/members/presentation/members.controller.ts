import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { MembersService } from '../application/members.service.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { AddMemberResultResponseDto } from './dto/add-member-result.response.dto.js';
import { MemberResponseDto } from './dto/member.response.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';

@ApiTags('members')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequirePermissions()
  @ApiOkResponse({ type: MemberResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<MemberResponseDto[]> {
    return this.membersService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('members.manage')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: AddMemberResultResponseDto })
  add(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: AddMemberDto,
  ): Promise<AddMemberResultResponseDto> {
    return this.membersService.add(actor, access, dto);
  }

  /** Any member may leave; the last owner is still blocked by the service. */
  @Post('leave')
  @RequirePermissions()
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<void> {
    return this.membersService.remove(actor, access, actor.userId);
  }

  @Patch(':userId')
  @RequirePermissions('members.manage')
  @ApiOkResponse({ type: MemberResponseDto })
  updateRole(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberResponseDto> {
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
}
