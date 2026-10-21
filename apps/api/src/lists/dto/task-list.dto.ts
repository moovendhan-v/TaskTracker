import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  NAME_MAX,
  type CreateTaskListRequest,
  type TaskListResponse,
  type UpdateTaskListRequest,
} from '@taskflow/shared-types';

export class CreateTaskListDto implements CreateTaskListRequest {
  @ApiProperty({ maxLength: NAME_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;
}

export class UpdateTaskListDto extends PartialType(CreateTaskListDto) implements UpdateTaskListRequest {}

export class TaskListDto implements TaskListResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) spaceId: string;
  @ApiProperty() name: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
