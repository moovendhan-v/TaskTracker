import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { CurrentActor } from '../common/decorators/actor.decorator.js';
import { UUID_PIPE } from '../common/http/id-params.js';
import { RequirePermissions } from '../access/require-permissions.decorator.js';
import { CurrentAccess } from '../access/workspace-access.decorator.js';
import { CreateRoleDto, RoleDto, UpdateRoleDto } from './dto/role.dto.js';
import { RolesService } from './roles.service.js';

@ApiTags('roles')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions()
  @ApiOkResponse({ type: RoleDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<RoleDto[]> {
    return this.rolesService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('roles.manage')
  @ApiOkResponse({ type: RoleDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.create(actor, access, dto);
  }

  @Patch(':roleId')
  @RequirePermissions('roles.manage')
  @ApiOkResponse({ type: RoleDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('roleId', UUID_PIPE) roleId: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleDto> {
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
