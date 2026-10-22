import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  PERMISSIONS,
  ROLE_NAME_MAX,
  type CreateRoleRequest,
  type Permission,
  type RoleResponse,
  type UpdateRoleRequest,
} from '@taskflow/shared-types';
import { IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('Role')
export class RoleGql implements RoleResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true, description: 'Set for built-in roles' }) systemKey: string | null;
  @Field(() => [String]) permissions: Permission[];
}

@InputType()
export class CreateRoleInput implements CreateRoleRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ROLE_NAME_MAX)
  name: string;

  @Field(() => [String], { description: 'Permission keys such as task.create' })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PERMISSIONS.length)
  @IsIn(PERMISSIONS, { each: true })
  permissions: Permission[];
}

@InputType()
export class UpdateRoleInput implements UpdateRoleRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
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
