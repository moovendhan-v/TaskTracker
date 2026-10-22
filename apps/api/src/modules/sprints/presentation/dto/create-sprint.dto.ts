import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NAME_MAX, SPRINT_GOAL_MAX, type CreateSprintRequest } from '@taskflow/shared-types';

export class CreateSprintDto implements CreateSprintRequest {
  @ApiProperty({ maxLength: NAME_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @ApiPropertyOptional({ maxLength: SPRINT_GOAL_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(SPRINT_GOAL_MAX)
  goal?: string;

  @ApiProperty({ format: 'date', example: '2026-11-02' })
  @IsISO8601({ strict: true })
  startDate: string;

  @ApiProperty({ format: 'date', example: '2026-11-13' })
  @IsISO8601({ strict: true })
  endDate: string;
}
