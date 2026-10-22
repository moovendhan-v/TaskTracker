import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { LEAVE_REASON_MAX, type CreateLeaveRequestRequest } from '@taskflow/shared-types';

export class CreateLeaveRequestDto implements CreateLeaveRequestRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  leaveTypeId: string;

  @ApiProperty({ format: 'date', example: '2026-11-02' })
  @IsISO8601({ strict: true })
  startDate: string;

  @ApiProperty({ format: 'date', example: '2026-11-06' })
  @IsISO8601({ strict: true })
  endDate: string;

  @ApiPropertyOptional({ maxLength: LEAVE_REASON_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(LEAVE_REASON_MAX)
  reason?: string;
}
