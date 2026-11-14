import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  ESTIMATE_MINUTES_MAX,
  STORY_POINTS_MAX,
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
  TASK_TYPES,
  type CreateTaskRequest,
  type CustomFieldValues,
  type TaskActivityResponse,
  type TaskMetadata,
  type TaskPriority,
  type TaskRelationKind,
  type TaskRelationResponse,
  type TaskResponse,
  type TaskType,
  type UpdateTaskRequest,
} from '@taskflow/shared-types';
import { SensitiveField } from '../../../../core/access/sensitive-field.decorator.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { CustomFieldValuesScalar } from '../../../../core/graphql/custom-field-values.scalar.js';
import { TaskPriorityEnum, TaskRelationKindEnum, TaskTypeEnum } from '../../../../core/graphql/enums.js';
import { MetadataScalar } from '../../../../core/graphql/metadata.scalar.js';
import { PageOf } from '../../../../core/graphql/page.type.js';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';
import { TaskStatusGql } from '../../../statuses/presentation/graphql/status.types.js';

@ObjectType('Task')
export class TaskGql implements TaskResponse {
  @Field(() => ID) id: string;
  @Field(() => Int, { description: 'Short number, unique in the workspace (#978)' }) number: number;
  @Field(() => ID) listId: string;
  @Field(() => ID) spaceId: string;
  @Field(() => ID, { nullable: true }) parentId: string | null;
  @Field(() => TaskTypeEnum) type: TaskType;
  @Field() title: string;
  @Field() description: string;
  @Field(() => ID) statusId: string;
  @Field(() => TaskStatusGql) status: TaskStatusGql;
  @Field(() => TaskPriorityEnum) priority: TaskPriority;
  @Field(() => String, { nullable: true }) startDate: string | null;
  @Field(() => String, { nullable: true }) dueDate: string | null;
  @Field(() => ID, { nullable: true }) assigneeId: string | null;
  @Field(() => [ID], { description: 'All assigned user IDs' }) assigneeIds: string[];
  @Field(() => ID, { nullable: true }) sprintId: string | null;
  @Field(() => Float) position: number;
  @Field(() => Int, { nullable: true }) estimateMinutes: number | null;
  @Field(() => Int, { nullable: true, description: 'Story points, 0–100' }) storyPoints: number | null;
  @Field(() => Int, { nullable: true, description: '0–100' }) progress: number | null;
  @Field(() => Int) subtaskCount: number;
  @SensitiveField('task.metadata', () => MetadataScalar) metadata: TaskMetadata | null;
  @Field(() => CustomFieldValuesScalar) customFields: CustomFieldValues;
  @Field(() => String, { nullable: true }) completedAt: string | null;
  @Field(() => ID) createdById: string;
  @Field() createdAt: string;
  @Field() updatedAt: string;
}

@ObjectType('TaskPage')
export class TaskPageGql extends PageOf(TaskGql) {}

@ObjectType('RelatedTask')
export class RelatedTaskGql {
  @Field(() => ID) id: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field(() => TaskStatusGql) status: TaskStatusGql;
}

@ObjectType('TaskRelation')
export class TaskRelationGql implements TaskRelationResponse {
  @Field(() => ID) id: string;
  @Field(() => TaskRelationKindEnum) kind: TaskRelationKind;
  @Field({ description: 'True when this task is the source: "this task blocks the other"' }) outgoing: boolean;
  @Field(() => RelatedTaskGql) task: RelatedTaskGql;
}

@ObjectType('TaskActivity')
export class TaskActivityGql implements TaskActivityResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) taskId: string;
  @Field(() => ID, { nullable: true }) actorId: string | null;
  @Field(() => String, { nullable: true }) actorName: string | null;
  @Field({ description: 'created, changed or related' }) kind: string;
  @Field(() => String, { nullable: true }) field: string | null;
  @Field(() => String, { nullable: true }) from: string | null;
  @Field(() => String, { nullable: true }) to: string | null;
  @Field() createdAt: string;
}

@FormSchema('task.create')
@InputType()
export class CreateTaskInput implements CreateTaskRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(TASK_TITLE_MAX) title: string;

  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TASK_DESCRIPTION_MAX) description?: string;

  @Field(() => TaskTypeEnum, { nullable: true }) @IsOmittable() @IsIn(TASK_TYPES) type?: TaskType;

  @Field(() => ID, { nullable: true, description: "One of the space's statuses; defaults to its first not-started status" })
  @IsOmittable()
  @IsUUID('4')
  statusId?: string;

  @Field(() => TaskPriorityEnum, { nullable: true }) @IsOmittable() @IsIn(TASK_PRIORITIES) priority?: TaskPriority;

  @Field(() => String, { nullable: true, description: 'ISO date-time' }) @IsClearable() @IsDateString() startDate?: string | null;

  @Field(() => String, { nullable: true, description: 'ISO date-time; null clears it' }) @IsClearable() @IsDateString() dueDate?: string | null;

  @Field(() => ID, { nullable: true }) @IsClearable() @IsString() @MaxLength(64) assigneeId?: string | null;

  @Field(() => [ID], { nullable: true, description: 'All assigned user IDs' })
  @IsOmittable()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @Field(() => ID, { nullable: true, description: 'Makes it a subtask of another task in the same list' })
  @IsClearable()
  @IsUUID('4')
  parentId?: string | null;

  @Field(() => Int, { nullable: true }) @IsClearable() @IsInt() @Min(0) @Max(ESTIMATE_MINUTES_MAX) estimateMinutes?: number | null;
  @Field(() => Int, { nullable: true, description: 'Story points, 0–100' }) @IsClearable() @IsInt() @Min(0) @Max(STORY_POINTS_MAX) storyPoints?: number | null;

  @Field(() => MetadataScalar, { nullable: true }) @IsOmittable() metadata?: TaskMetadata;

  @Field(() => CustomFieldValuesScalar, { nullable: true, description: 'Values keyed by custom field id' }) @IsOmittable() customFields?: CustomFieldValues;
}

@FormSchema('task.update')
@InputType()
export class UpdateTaskInput implements UpdateTaskRequest {
  @Field({ nullable: true }) @IsOmittable() @IsString() @IsNotBlank() @MaxLength(TASK_TITLE_MAX) title?: string;

  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TASK_DESCRIPTION_MAX) description?: string;

  @Field(() => TaskTypeEnum, { nullable: true }) @IsOmittable() @IsIn(TASK_TYPES) type?: TaskType;

  @Field(() => ID, { nullable: true }) @IsOmittable() @IsUUID('4') statusId?: string;

  @Field(() => TaskPriorityEnum, { nullable: true }) @IsOmittable() @IsIn(TASK_PRIORITIES) priority?: TaskPriority;

  @Field(() => String, { nullable: true }) @IsClearable() @IsDateString() startDate?: string | null;

  @Field(() => String, { nullable: true }) @IsClearable() @IsDateString() dueDate?: string | null;

  @Field(() => ID, { nullable: true }) @IsClearable() @IsString() @MaxLength(64) assigneeId?: string | null;

  @Field(() => [ID], { nullable: true, description: 'All assigned user IDs' })
  @IsOmittable()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @Field(() => Float, { nullable: true }) @IsOmittable() @IsNumber({ allowNaN: false, allowInfinity: false }) position?: number;

  @Field(() => ID, { nullable: true, description: 'null moves the task to the backlog; needs sprint.manage' }) @IsClearable() @IsUUID('4') sprintId?: string | null;

  @Field(() => Int, { nullable: true }) @IsClearable() @IsInt() @Min(0) @Max(ESTIMATE_MINUTES_MAX) estimateMinutes?: number | null;
  @Field(() => Int, { nullable: true, description: 'Story points, 0–100' }) @IsClearable() @IsInt() @Min(0) @Max(STORY_POINTS_MAX) storyPoints?: number | null;

  @Field(() => Int, { nullable: true, description: '0–100' }) @IsClearable() @IsInt() @Min(0) @Max(100) progress?: number | null;

  @Field(() => MetadataScalar, { nullable: true, description: 'Merged into the current metadata; a key set to null is removed' })
  @IsOmittable()
  metadata?: TaskMetadata;

  @Field(() => CustomFieldValuesScalar, { nullable: true, description: 'Merged into the current values; null clears a field' })
  @IsOmittable()
  customFields?: CustomFieldValues;
}
