import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import type { UpdateTaskRequest } from '@taskflow/shared-types';
import { CreateTaskDto } from './create-task.dto.js';

export class UpdateTaskDto extends PartialType(CreateTaskDto) implements UpdateTaskRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'null moves the task to the backlog' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  sprintId?: string | null;
}
