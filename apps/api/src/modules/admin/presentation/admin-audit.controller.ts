import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePlatformAdmin } from '../../../core/access/require-platform-admin.decorator.js';
import { AuditLogService } from '../../audit-log/application/audit-log.service.js';
import { AuditLogQueryDto } from '../../audit-log/presentation/dto/audit-log-query.dto.js';
import { AuditLogPageResponseDto } from '../../audit-log/presentation/dto/audit-log-entry.response.dto.js';

@ApiTags('admin')
@ApiCookieAuth()
@RequirePlatformAdmin()
@Controller('admin/audit-log')
export class AdminAuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOkResponse({ type: AuditLogPageResponseDto })
  list(@Query() query: AuditLogQueryDto): Promise<AuditLogPageResponseDto> {
    return this.auditLogService.forPlatform(query);
  }
}
