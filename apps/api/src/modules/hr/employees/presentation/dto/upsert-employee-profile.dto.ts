import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { EMPLOYMENT_TYPES, JOB_TITLE_MAX, type EmploymentType, type UpsertEmployeeProfileRequest } from '@taskflow/shared-types';

/** Every field is optional and nullable: omit to keep, null to clear. */
export class UpsertEmployeeProfileDto implements UpsertEmployeeProfileRequest {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: JOB_TITLE_MAX })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(JOB_TITLE_MAX)
  jobTitle?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  departmentId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  managerUserId?: string | null;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: EmploymentType | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  startDate?: string | null;
}
