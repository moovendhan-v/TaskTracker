import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { NAME_MAX, type CreateDepartmentRequest, type DepartmentResponse, type UpdateDepartmentRequest } from '@taskflow/shared-types';
import { IsOmittable } from '../../../../../core/graphql/validation.js';

@ObjectType('Department')
export class DepartmentGql implements DepartmentResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => ID, { nullable: true }) headUserId: string | null;
  @Field(() => Int) memberCount: number;
}

@InputType()
export class CreateDepartmentInput implements CreateDepartmentRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  headUserId?: string | null;
}

@InputType()
export class UpdateDepartmentInput implements UpdateDepartmentRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  headUserId?: string | null;
}
