import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  NAME_MAX,
  type CreateWorkspaceRequest,
  type TwoStepPolicyResponse,
  type TwoStepRequirement,
  type Permission,
  type UpdateWorkspaceRequest,
  type WorkspaceResponse,
} from '@taskflow/shared-types';
import { IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';
import { SpaceRuleGql } from '../../../roles/presentation/graphql/policy.types.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('Workspace')
export class WorkspaceGql implements WorkspaceResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() color: string;
  @Field({ description: "The caller's role in this workspace" }) roleName: string;
  @Field(() => [String], { description: "The caller's permissions, e.g. task.create" }) permissions: Permission[];
  @Field(() => [SpaceRuleGql], { description: 'Spaces where some of those permissions are taken away' }) spaceRules: SpaceRuleGql[];
  @Field({ description: 'The workspace requires two-step sign-in and the caller has not set it up, so some permissions are held back' }) twoStepMissing: boolean;
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

@ObjectType('TwoStepPolicy', { description: "Whether the workspace requires two-step sign-in (an authenticator app or a passkey), and of whom" })
export class TwoStepPolicyGql implements TwoStepPolicyResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) workspaceId: string;
  @Field(() => String, { description: 'off, admins (people with admin rights) or everyone' }) require: TwoStepRequirement;
  @Field({ description: 'Whether the caller has two-step sign-in' }) callerHasTwoStep: boolean;
}
