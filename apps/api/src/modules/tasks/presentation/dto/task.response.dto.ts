import { ApiProperty } from '@nestjs/swagger';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskResponse,
  type TaskStatus,
} from '@taskflow/shared-types';

export class TaskResponseDto implements TaskResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) listId: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: TASK_STATUSES }) status: TaskStatus;
  @ApiProperty({ enum: TASK_PRIORITIES }) priority: TaskPriority;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) dueDate: string | null;
  @ApiProperty({ type: String, nullable: true }) assigneeId: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) sprintId: string | null;
  @ApiProperty() position: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}
