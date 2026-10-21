import { ApiProperty } from '@nestjs/swagger';
import type { TaskListResponse } from '@taskflow/shared-types';

export class TaskListResponseDto implements TaskListResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) spaceId: string;
  @ApiProperty() name: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
