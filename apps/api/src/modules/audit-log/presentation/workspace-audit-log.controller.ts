import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../core/access/require-permissions.decorator.js';
import type { WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { AuditLogService } from '../application/audit-log.service.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';
import { AuditLogPageResponseDto } from './dto/audit-log-entry.response.dto.js';

@ApiTags('audit-log')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/audit-log')
export class WorkspaceAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermissions('audit.view')
  @ApiOkResponse({ type: AuditLogPageResponseDto })
  list(@CurrentAccess() access: WorkspaceAccess, @Query() query: AuditLogQueryDto): Promise<AuditLogPageResponseDto> {
    return this.auditLogService.forWorkspace(access.workspaceId, query);
  }
}
