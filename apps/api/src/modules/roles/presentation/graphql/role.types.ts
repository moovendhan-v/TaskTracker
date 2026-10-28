import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { AttachedPolicyGql, PolicyDocumentGql, SpaceRuleGql } from './policy.types.js';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsString, MaxLength } from 'class-validator';
import {
  PERMISSIONS,
  ROLE_NAME_MAX,
  type CreateRoleRequest,
  type Permission,
  type RoleResponse,
  type UpdateRoleRequest,
} from '@taskflow/shared-types';
import { IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('Role')
export class RoleGql implements RoleResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true, description: 'Set for built-in roles' }) systemKey: string | null;
  @Field(() => [String], { description: 'Permissions granted directly on the role' }) permissions: Permission[];
  @Field(() => PolicyDocumentGql, { description: 'Statements that belong to this role only' }) inlinePolicy: PolicyDocumentGql;
  @Field(() => [AttachedPolicyGql]) policies: AttachedPolicyGql[];
  @Field(() => [String], { description: 'What members with this role can do after every policy and deny' }) effectivePermissions: Permission[];
  @Field(() => [String], { description: 'Protected fields members with this role can read' }) readableFields: string[];
  @Field(() => [SpaceRuleGql], { description: 'Spaces where the role is limited' }) spaceRules: SpaceRuleGql[];
}

@FormSchema('role.create')
@InputType()
export class CreateRoleInput implements CreateRoleRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(ROLE_NAME_MAX)
  name: string;

  @Field(() => [String], { description: 'Permission keys such as task.create' })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PERMISSIONS.length)
  @IsIn(PERMISSIONS, { each: true })
  permissions: Permission[];
}

@FormSchema('role.update')
@InputType()
export class UpdateRoleInput implements UpdateRoleRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(ROLE_NAME_MAX)
  name?: string;

  @Field(() => [String], { nullable: true })
  @IsOmittable()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PERMISSIONS.length)
  @IsIn(PERMISSIONS, { each: true })
  permissions?: Permission[];
}
