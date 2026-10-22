import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  NAME_MAX,
  type CreateWorkspaceRequest,
  type Permission,
  type UpdateWorkspaceRequest,
  type WorkspaceResponse,
} from '@taskflow/shared-types';

@ObjectType('Workspace')
export class WorkspaceGql implements WorkspaceResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() color: string;
  @Field({ description: "The caller's role in this workspace" }) roleName: string;
  @Field(() => [String], { description: "The caller's permissions, e.g. task.create" }) permissions: Permission[];
  @Field() createdAt: string;
}

@InputType()
export class CreateWorkspaceInput implements CreateWorkspaceRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}

@InputType()
export class UpdateWorkspaceInput implements UpdateWorkspaceRequest {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}
