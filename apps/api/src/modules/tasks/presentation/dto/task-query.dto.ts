import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TASK_STATUSES, type TaskQuery, type TaskStatus } from '@taskflow/shared-types';
import { PageQueryDto } from '../../../../core/http/dto/page-query.dto.js';

export class TaskQueryDto extends PageQueryDto implements TaskQuery {
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
