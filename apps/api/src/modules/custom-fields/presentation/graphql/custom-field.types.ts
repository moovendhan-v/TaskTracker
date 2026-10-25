import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import {
  COLOR_PATTERN,
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_LIMITS,
  CUSTOM_FIELD_TYPES,
  type CustomFieldEntity,
  type CustomFieldOption,
  type CustomFieldResponse,
  type CustomFieldType,
  type SaveCustomFieldRequest,
} from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { CustomFieldEntityEnum, CustomFieldTypeEnum } from '../../../../core/graphql/enums.js';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('CustomFieldOption')
export class CustomFieldOptionGql implements CustomFieldOption {
  @Field() id: string;
  @Field() label: string;
  @Field(() => String, { nullable: true }) color?: string | null;
}

@ObjectType('CustomField')
export class CustomFieldGql implements CustomFieldResponse {
  @Field(() => ID) id: string;
  @Field(() => ID, { nullable: true, description: 'Null: applies in every space' }) spaceId: string | null;
  @Field(() => CustomFieldEntityEnum) entity: CustomFieldEntity;
  @Field() name: string;
  @Field(() => CustomFieldTypeEnum) type: CustomFieldType;
  @Field(() => [CustomFieldOptionGql]) options: CustomFieldOptionGql[];
  @Field() required: boolean;
  @Field(() => Int) position: number;
}

@InputType('CustomFieldOptionInput')
export class CustomFieldOptionInput implements CustomFieldOption {
  @Field({ nullable: true, description: 'Keep the id of an existing option so values stay attached' }) @IsOmittable() @IsString() @MaxLength(32) id: string;
  @Field() @IsString() @IsNotBlank() @MaxLength(60) label: string;
  @Field(() => String, { nullable: true }) @IsClearable() @Matches(new RegExp(COLOR_PATTERN)) color?: string | null;
}

@FormSchema('customField.create')
@InputType('CreateCustomFieldInput')
export class CreateCustomFieldInput implements SaveCustomFieldRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(CUSTOM_FIELD_LIMITS.nameMax) name: string;
  @Field(() => CustomFieldTypeEnum) @IsIn(CUSTOM_FIELD_TYPES) type: CustomFieldType;
  @Field(() => CustomFieldEntityEnum, { nullable: true }) @IsOmittable() @IsIn(CUSTOM_FIELD_ENTITIES) entity?: CustomFieldEntity;
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') spaceId?: string | null;

  @Field(() => [CustomFieldOptionInput], { nullable: true })
  @IsOmittable()
  @IsArray()
  @ArrayMaxSize(CUSTOM_FIELD_LIMITS.optionsMax)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionInput)
  options?: CustomFieldOptionInput[];

  @Field({ nullable: true }) @IsOmittable() @IsBoolean() required?: boolean;
}

@FormSchema('customField.update')
@InputType('UpdateCustomFieldInput')
export class UpdateCustomFieldInput {
  @Field({ nullable: true }) @IsOmittable() @IsString() @IsNotBlank() @MaxLength(CUSTOM_FIELD_LIMITS.nameMax) name?: string;

  @Field(() => [CustomFieldOptionInput], { nullable: true })
  @IsOmittable()
  @IsArray()
  @ArrayMaxSize(CUSTOM_FIELD_LIMITS.optionsMax)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionInput)
  options?: CustomFieldOptionInput[];

  @Field({ nullable: true }) @IsOmittable() @IsBoolean() required?: boolean;
}
