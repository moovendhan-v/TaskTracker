import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePlatformAdmin } from '../../../core/access/require-platform-admin.decorator.js';
import { CurrentActor } from '../../../core/http/decorators/current-actor.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { AdminUsersService } from '../application/admin-users.service.js';
import { AdminSearchQueryDto } from './dto/admin-query.dto.js';
import { AdminUserPageResponseDto, AdminUserResponseDto } from './dto/admin.response.dto.js';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto.js';

@ApiTags('admin')
@ApiCookieAuth()
@RequirePlatformAdmin()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOkResponse({ type: AdminUserPageResponseDto })
  list(@Query() query: AdminSearchQueryDto): Promise<AdminUserPageResponseDto> {
    return this.adminUsersService.list(query);
  }

  @Patch(':userId')
  @ApiOkResponse({ type: AdminUserResponseDto })
  update(@CurrentActor() actor: Actor, @Param('userId') userId: string, @Body() dto: UpdateAdminUserDto): Promise<AdminUserResponseDto> {
    return this.adminUsersService.update(actor, userId, dto);
  }
}
