import { ApiProperty } from '@nestjs/swagger';
import type { LeaveTypeResponse } from '@taskflow/shared-types';

export class LeaveTypeResponseDto implements LeaveTypeResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() color: string;
  @ApiProperty({ type: Number, nullable: true }) annualAllowanceDays: number | null;
  @ApiProperty() requiresApproval: boolean;
}
