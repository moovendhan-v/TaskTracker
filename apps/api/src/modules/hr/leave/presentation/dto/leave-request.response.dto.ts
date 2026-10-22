import { ApiProperty } from '@nestjs/swagger';
import { LEAVE_STATUSES, type LeaveRequestResponse, type LeaveStatus, type Paginated } from '@taskflow/shared-types';

export class LeaveRequestResponseDto implements LeaveRequestResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() userId: string;
  @ApiProperty() userName: string;
  @ApiProperty({ format: 'uuid' }) leaveTypeId: string;
  @ApiProperty() leaveTypeName: string;
  @ApiProperty({ format: 'date' }) startDate: string;
  @ApiProperty({ format: 'date' }) endDate: string;
  @ApiProperty() days: number;
  @ApiProperty() reason: string;
  @ApiProperty({ enum: LEAVE_STATUSES }) status: LeaveStatus;
  @ApiProperty({ type: String, nullable: true }) decidedById: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decidedAt: string | null;
  @ApiProperty() decisionNote: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class LeaveRequestPageResponseDto implements Paginated<LeaveRequestResponseDto> {
  @ApiProperty({ type: LeaveRequestResponseDto, isArray: true }) items: LeaveRequestResponseDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}
