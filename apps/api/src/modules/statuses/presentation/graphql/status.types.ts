import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsIn, IsString, MaxLength, Matches } from 'class-validator';
import { COLOR_PATTERN, STATUS_CATEGORIES, STATUS_NAME_MAX, type SaveTaskStatusRequest, type StatusCategory, type TaskStatusResponse } from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { StatusCategoryEnum } from '../../../../core/graphql/enums.js';
import { IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('TaskStatus')
export class TaskStatusGql implements TaskStatusResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field() color: string;
  @Field(() => StatusCategoryEnum, { description: 'What the status means: unstarted, started, review, blocked, done or cancelled' })
  category: StatusCategory;
  @Field(() => Int) position: number;
}

@FormSchema('status.create')
@InputType('CreateTaskStatusInput')
export class CreateTaskStatusInput implements SaveTaskStatusRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(STATUS_NAME_MAX) name: string;
  @Field() @Matches(new RegExp(COLOR_PATTERN)) color: string;
  @Field(() => StatusCategoryEnum) @IsIn(STATUS_CATEGORIES) category: StatusCategory;
}

@FormSchema('status.update')
@InputType('UpdateTaskStatusInput')
export class UpdateTaskStatusInput implements Partial<SaveTaskStatusRequest> {
  @Field({ nullable: true }) @IsOmittable() @IsString() @IsNotBlank() @MaxLength(STATUS_NAME_MAX) name?: string;
  @Field({ nullable: true }) @IsOmittable() @Matches(new RegExp(COLOR_PATTERN)) color?: string;
  @Field(() => StatusCategoryEnum, { nullable: true }) @IsOmittable() @IsIn(STATUS_CATEGORIES) category?: StatusCategory;
}
