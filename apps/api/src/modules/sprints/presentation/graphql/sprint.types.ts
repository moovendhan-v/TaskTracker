import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsISO8601, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  NAME_MAX,
  SPRINT_GOAL_MAX,
  type CreateSprintRequest,
  type SprintResponse,
  type SprintStatus,
  type UpdateSprintRequest,
} from '@taskflow/shared-types';
import { SprintStatusEnum } from '../../../../core/graphql/enums.js';
import { IsOmittable } from '../../../../core/graphql/validation.js';

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
}

@InputType()
export class CreateSprintInput implements CreateSprintRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(SPRINT_GOAL_MAX)
  goal?: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsISO8601({ strict: true })
  startDate: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsISO8601({ strict: true })
  endDate: string;
}

@InputType()
export class UpdateSprintInput implements UpdateSprintRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(SPRINT_GOAL_MAX)
  goal?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsISO8601({ strict: true })
  startDate?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsISO8601({ strict: true })
  endDate?: string;
}
