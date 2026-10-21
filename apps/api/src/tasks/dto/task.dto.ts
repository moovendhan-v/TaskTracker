import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX,
  type CreateTaskRequest,
  type Paginated,
  type TaskPriority,
  type TaskQuery,
  type TaskResponse,
  type TaskStatus,
  type UpdateTaskRequest,
} from '@taskflow/shared-types';

class TaskFieldsDto {
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

export class CreateTaskDto extends TaskFieldsDto implements CreateTaskRequest {
  @ApiProperty({ maxLength: TASK_TITLE_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX)
  title: string;
}

export class UpdateTaskDto extends TaskFieldsDto implements UpdateTaskRequest {
  @ApiPropertyOptional({ maxLength: TASK_TITLE_MAX })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}

export class TaskQueryDto implements TaskQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: PAGE_SIZE_MAX, default: PAGE_SIZE_DEFAULT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  pageSize?: number;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class TaskDto implements TaskResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) listId: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: TASK_STATUSES }) status: TaskStatus;
  @ApiProperty({ enum: TASK_PRIORITIES }) priority: TaskPriority;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) dueDate: string | null;
  @ApiProperty({ type: String, nullable: true }) assigneeId: string | null;
  @ApiProperty() position: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class TaskPageDto implements Paginated<TaskDto> {
  @ApiProperty({ type: TaskDto, isArray: true }) items: TaskDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}
