import { PartialType } from '@nestjs/swagger';
import type { UpdateTaskListRequest } from '@taskflow/shared-types';
import { CreateTaskListDto } from './create-task-list.dto.js';

export class UpdateTaskListDto extends PartialType(CreateTaskListDto) implements UpdateTaskListRequest {}
