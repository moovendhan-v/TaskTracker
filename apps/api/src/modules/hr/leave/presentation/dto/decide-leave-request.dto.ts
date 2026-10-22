import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LEAVE_DECISIONS, LEAVE_REASON_MAX, type DecideLeaveRequestRequest, type LeaveDecision } from '@taskflow/shared-types';

export class DecideLeaveRequestDto implements DecideLeaveRequestRequest {
  @ApiProperty({ enum: LEAVE_DECISIONS })
  @IsIn(LEAVE_DECISIONS)
  decision: LeaveDecision;

  @ApiPropertyOptional({ maxLength: LEAVE_REASON_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(LEAVE_REASON_MAX)
  note?: string;
}
