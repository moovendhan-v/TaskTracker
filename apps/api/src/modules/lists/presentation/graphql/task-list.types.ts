import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NAME_MAX, type CreateTaskListRequest, type TaskListResponse } from '@taskflow/shared-types';

@ObjectType('TaskList')
export class TaskListGql implements TaskListResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field() createdAt: string;
}

@InputType()
export class TaskListInput implements CreateTaskListRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;
}
