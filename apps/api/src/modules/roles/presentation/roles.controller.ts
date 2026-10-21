import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { RolesService } from '../application/roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { RoleResponseDto } from './dto/role.response.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@ApiTags('roles')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions()
  @ApiOkResponse({ type: RoleResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<RoleResponseDto[]> {
    return this.rolesService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('roles.manage')
  @ApiOkResponse({ type: RoleResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.create(actor, access, dto);
  }

  @Patch(':roleId')
  @RequirePermissions('roles.manage')
  @ApiOkResponse({ type: RoleResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('roleId', UUID_PIPE) roleId: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(actor, access, roleId, dto);
  }

  @Delete(':roleId')
  @RequirePermissions('roles.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('roleId', UUID_PIPE) roleId: string,
  ): Promise<void> {
    return this.rolesService.remove(actor, access, roleId);
  }
}
