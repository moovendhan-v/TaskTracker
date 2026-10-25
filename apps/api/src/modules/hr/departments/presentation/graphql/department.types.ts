import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';
import { NAME_MAX, type CreateDepartmentRequest, type DepartmentResponse, type UpdateDepartmentRequest } from '@taskflow/shared-types';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../../core/graphql/validation.js';
import { FormSchema } from '../../../../../core/forms/form-schema.decorators.js';

@ObjectType('Department')
export class DepartmentGql implements DepartmentResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => ID, { nullable: true }) headUserId: string | null;
  @Field(() => Int) memberCount: number;
}

@FormSchema('hr.department.create')
@InputType()
export class CreateDepartmentInput implements CreateDepartmentRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;

  @Field(() => ID, { nullable: true })
  @IsClearable()
  @IsString()
  @MaxLength(64)
  headUserId?: string | null;
}

@FormSchema('hr.department.update')
@InputType()
export class UpdateDepartmentInput implements UpdateDepartmentRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field(() => ID, { nullable: true })
  @IsClearable()
  @IsString()
  @MaxLength(64)
  headUserId?: string | null;
}
