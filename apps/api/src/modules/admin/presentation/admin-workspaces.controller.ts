import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePlatformAdmin } from '../../../core/access/require-platform-admin.decorator.js';
import { AdminWorkspacesService } from '../application/admin-workspaces.service.js';
import { AdminSearchQueryDto } from './dto/admin-query.dto.js';
import { AdminWorkspacePageResponseDto } from './dto/admin.response.dto.js';

@ApiTags('admin')
@ApiCookieAuth()
@RequirePlatformAdmin()
@Controller('admin/workspaces')
export class AdminWorkspacesController {
  constructor(private readonly adminWorkspacesService: AdminWorkspacesService) {}

  @Get()
  @ApiOkResponse({ type: AdminWorkspacePageResponseDto })
  list(@Query() query: AdminSearchQueryDto): Promise<AdminWorkspacePageResponseDto> {
    return this.adminWorkspacesService.list(query);
  }
}
