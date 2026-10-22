import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { AdminUserQuery, AdminWorkspaceQuery } from '@taskflow/shared-types';
import { PageQueryDto } from '../../../../core/http/dto/page-query.dto.js';

export class AdminSearchQueryDto extends PageQueryDto implements AdminUserQuery, AdminWorkspaceQuery {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
