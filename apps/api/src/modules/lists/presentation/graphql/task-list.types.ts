import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';
import { IsNotBlank } from '../../../../core/graphql/validation.js';
import { NAME_MAX, type CreateTaskListRequest, type TaskListResponse } from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('TaskList')
export class TaskListGql implements TaskListResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field() createdAt: string;
}

@FormSchema('list.save')
@InputType()
export class TaskListInput implements CreateTaskListRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;
}
