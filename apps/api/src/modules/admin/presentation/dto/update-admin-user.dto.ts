import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PLATFORM_ROLES, type PlatformRole, type UpdateAdminUserRequest } from '@taskflow/shared-types';

export class UpdateAdminUserDto implements UpdateAdminUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  suspended?: boolean;

  @ApiPropertyOptional({ enum: PLATFORM_ROLES })
  @IsOptional()
  @IsIn(PLATFORM_ROLES)
  platformRole?: PlatformRole;
}
