import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  NAME_MAX,
  type CreateWorkspaceRequest,
  type Permission,
  type UpdateWorkspaceRequest,
  type WorkspaceResponse,
} from '@taskflow/shared-types';
import { IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('Workspace')
export class WorkspaceGql implements WorkspaceResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() color: string;
  @Field({ description: "The caller's role in this workspace" }) roleName: string;
  @Field(() => [String], { description: "The caller's permissions, e.g. task.create" }) permissions: Permission[];
  @Field() createdAt: string;
}

@FormSchema('workspace.create')
@InputType()
export class CreateWorkspaceInput implements CreateWorkspaceRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOmittable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}

@FormSchema('workspace.update')
@InputType()
export class UpdateWorkspaceInput implements UpdateWorkspaceRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}
