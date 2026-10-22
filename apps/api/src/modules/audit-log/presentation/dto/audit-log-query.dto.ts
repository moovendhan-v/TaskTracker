import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { AuditLogQuery } from '@taskflow/shared-types';
import { PageQueryDto } from '../../../../core/http/dto/page-query.dto.js';

export class AuditLogQueryDto extends PageQueryDto implements AuditLogQuery {
  @ApiPropertyOptional({ maxLength: 80, description: 'Prefix of the action name, e.g. "hr."' })
  @IsOptional()
  @Matches(/^[a-z_.]+$/, { message: 'action may contain lowercase letters, dots and underscores' })
  @MaxLength(80)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Platform admins only' })
  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;
}
