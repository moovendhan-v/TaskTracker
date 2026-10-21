import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import {
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX,
  type CreateTaskRequest,
  type TaskPriority,
  type TaskStatus,
} from '@taskflow/shared-types';

export class CreateTaskDto implements CreateTaskRequest {
  @ApiProperty({ maxLength: TASK_TITLE_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX)
  title: string;

  @ApiPropertyOptional({ maxLength: TASK_DESCRIPTION_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX)
  description?: string;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  assigneeId?: string | null;
}
