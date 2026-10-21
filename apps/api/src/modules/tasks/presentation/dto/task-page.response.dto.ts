import { ApiProperty } from '@nestjs/swagger';
import type { Paginated } from '@taskflow/shared-types';
import { TaskResponseDto } from './task.response.dto.js';

export class TaskPageResponseDto implements Paginated<TaskResponseDto> {
  @ApiProperty({ type: TaskResponseDto, isArray: true }) items: TaskResponseDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}
