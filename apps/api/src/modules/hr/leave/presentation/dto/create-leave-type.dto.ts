import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { COLOR_PATTERN, LEAVE_ALLOWANCE_MAX, NAME_MAX, type CreateLeaveTypeRequest } from '@taskflow/shared-types';

export class CreateLeaveTypeDto implements CreateLeaveTypeRequest {
  @ApiProperty({ maxLength: NAME_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @ApiPropertyOptional({ pattern: COLOR_PATTERN })
  @IsOptional()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: LEAVE_ALLOWANCE_MAX, description: 'null means unlimited' })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(LEAVE_ALLOWANCE_MAX)
  annualAllowanceDays: number | null;

  @ApiPropertyOptional({ description: 'Defaults to true' })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
