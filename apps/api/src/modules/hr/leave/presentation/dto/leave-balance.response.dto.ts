import { ApiProperty } from '@nestjs/swagger';
import type { LeaveBalanceResponse } from '@taskflow/shared-types';

export class LeaveBalanceResponseDto implements LeaveBalanceResponse {
  @ApiProperty({ format: 'uuid' }) leaveTypeId: string;
  @ApiProperty() leaveTypeName: string;
  @ApiProperty() color: string;
  @ApiProperty() year: number;
  @ApiProperty({ type: Number, nullable: true }) allowanceDays: number | null;
  @ApiProperty() usedDays: number;
  @ApiProperty() pendingDays: number;
  @ApiProperty({ type: Number, nullable: true }) remainingDays: number | null;
}
