import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import {
  NAME_MAX,
  SPRINT_GOAL_MAX,
  SPRINT_COMPLETE_MAX_MOVES,
  SPRINT_MAX_DAYS,
  type CreateSprintRequest,
  type SprintResponse,
  type SprintStatus,
  type UpdateSprintRequest,
} from '@taskflow/shared-types';
import { SprintStatusEnum } from '../../../../core/graphql/enums.js';
import { IsCalendarDate, IsClearable, IsNotBlank, IsOmittable, OnOrAfter, WithinDaysOf } from '../../../../core/graphql/validation.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('Sprint')
export class SprintGql implements SprintResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field() goal: string;
  @Field({ description: 'yyyy-mm-dd' }) startDate: string;
  @Field({ description: 'yyyy-mm-dd' }) endDate: string;
  @Field(() => SprintStatusEnum) status: SprintStatus;
  @Field(() => Int) totalTasks: number;
  @Field(() => Int) doneTasks: number;
  @Field(() => String, { nullable: true }) completedAt: string | null;
  @Field(() => Int, { nullable: true, description: 'Tasks in the sprint when it was completed; null before then' }) committedTasks: number | null;
}

@FormSchema('sprint.create')
@InputType()
export class CreateSprintInput implements CreateSprintRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(SPRINT_GOAL_MAX)
  goal?: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsCalendarDate()
  startDate: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsCalendarDate()
  @OnOrAfter('startDate')
  @WithinDaysOf('startDate', SPRINT_MAX_DAYS)
  endDate: string;
}

@FormSchema('sprint.update')
@InputType()
export class UpdateSprintInput implements UpdateSprintRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(SPRINT_GOAL_MAX)
  goal?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsCalendarDate()
  startDate?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsCalendarDate()
  @OnOrAfter('startDate')
  @WithinDaysOf('startDate', SPRINT_MAX_DAYS)
  endDate?: string;
}

@InputType('SprintTaskMoveInput')
export class SprintTaskMoveInput {
  @Field(() => ID) @IsUUID('4') taskId: string;
  @Field(() => ID, { nullable: true, description: 'A planned sprint in the same space; null for the backlog' }) @IsClearable() @IsUUID('4') sprintId: string | null;
}

/** Wraps the list so every move is validated (list arguments of inputs aren't). */
@InputType('CompleteSprintMovesInput')
export class CompleteSprintMovesInput {
  @Field(() => [SprintTaskMoveInput])
  @IsArray()
  @ArrayMaxSize(SPRINT_COMPLETE_MAX_MOVES)
  @ValidateNested({ each: true })
  @Type(() => SprintTaskMoveInput)
  moves: SprintTaskMoveInput[];
}
