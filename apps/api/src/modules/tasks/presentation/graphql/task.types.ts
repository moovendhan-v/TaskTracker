import { ArgsType, Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import {
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX,
  type CreateTaskRequest,
  type TaskPriority,
  type TaskResponse,
  type TaskStatus,
  type UpdateTaskRequest,
} from '@taskflow/shared-types';
import { TaskPriorityEnum, TaskStatusEnum } from '../../../../core/graphql/enums.js';
import { PageOf, WorkspacePageArgs } from '../../../../core/graphql/page.type.js';
import { IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('Task')
export class TaskGql implements TaskResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) listId: string;
  @Field() title: string;
  @Field() description: string;
  @Field(() => TaskStatusEnum) status: TaskStatus;
  @Field(() => TaskPriorityEnum) priority: TaskPriority;
  @Field(() => String, { nullable: true }) dueDate: string | null;
  @Field(() => ID, { nullable: true }) assigneeId: string | null;
  @Field(() => ID, { nullable: true }) sprintId: string | null;
  @Field(() => Float) position: number;
  @Field() createdAt: string;
  @Field() updatedAt: string;
}

@ObjectType('TaskPage')
export class TaskPageGql extends PageOf(TaskGql) {}

@ArgsType()
export class TaskListArgs extends WorkspacePageArgs {
  @Field(() => ID)
  @IsUUID('4')
  listId: string;

  @Field(() => TaskStatusEnum, { nullable: true })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

@InputType()
export class CreateTaskInput implements CreateTaskRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX)
  title: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX)
  description?: string;

  @Field(() => TaskStatusEnum, { nullable: true })
  @IsOmittable()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @Field(() => TaskPriorityEnum, { nullable: true })
  @IsOmittable()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @Field(() => String, { nullable: true, description: 'ISO date-time; null clears it' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  assigneeId?: string | null;
}

@InputType()
export class UpdateTaskInput implements UpdateTaskRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX)
  title?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX)
  description?: string;

  @Field(() => TaskStatusEnum, { nullable: true })
  @IsOmittable()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @Field(() => TaskPriorityEnum, { nullable: true })
  @IsOmittable()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  assigneeId?: string | null;

  @Field(() => Float, { nullable: true })
  @IsOmittable()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;

  @Field(() => ID, { nullable: true, description: 'null moves the task to the backlog; needs sprint.manage' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  sprintId?: string | null;
}
