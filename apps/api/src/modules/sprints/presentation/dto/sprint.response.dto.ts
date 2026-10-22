import { ApiProperty } from '@nestjs/swagger';
import { SPRINT_STATUSES, type SprintResponse, type SprintStatus } from '@taskflow/shared-types';

export class SprintResponseDto implements SprintResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) spaceId: string;
  @ApiProperty() name: string;
  @ApiProperty() goal: string;
  @ApiProperty({ format: 'date' }) startDate: string;
  @ApiProperty({ format: 'date' }) endDate: string;
  @ApiProperty({ enum: SPRINT_STATUSES }) status: SprintStatus;
  @ApiProperty() totalTasks: number;
  @ApiProperty() doneTasks: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt: string | null;
}
