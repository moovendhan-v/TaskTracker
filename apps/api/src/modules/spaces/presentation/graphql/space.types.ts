import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  ICON_KEYS,
  type IconKey,
  NAME_MAX,
  SPACE_STATUSES,
  type CreateSpaceRequest,
  type CustomFieldValues,
  type SpaceResponse,
  type SpaceStatus,
  type UpdateSpaceRequest,
} from '@taskflow/shared-types';
import { CustomFieldValuesScalar } from '../../../../core/graphql/custom-field-values.scalar.js';
import { SpaceStatusEnum, IconKeyEnum } from '../../../../core/graphql/enums.js';
import { IsCalendarDate, IsClearable, IsNotBlank, IsOmittable, OnOrAfter } from '../../../../core/graphql/validation.js';
import { SPACE_STATUS_NOTE_MAX } from '../../domain/space.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('Space')
export class SpaceGql implements SpaceResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) workspaceId: string;
  @Field() name: string;
  @Field() color: string;
  @Field(() => IconKeyEnum, { nullable: true, description: 'Icon key; null shows the first letter' }) icon: IconKey | null;
  @Field(() => SpaceStatusEnum, { description: 'Project health' }) status: SpaceStatus;
  @Field() statusNote: string;
  @Field(() => String, { nullable: true, description: 'yyyy-mm-dd' }) startDate: string | null;
  @Field(() => String, { nullable: true, description: 'yyyy-mm-dd' }) dueDate: string | null;
  @Field(() => CustomFieldValuesScalar) customFields: CustomFieldValues;
  @Field() createdAt: string;
}

@FormSchema('space.create')
@InputType()
export class CreateSpaceInput implements CreateSpaceRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOmittable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;

  @Field(() => IconKeyEnum, { nullable: true })
  @IsClearable()
  @IsIn(ICON_KEYS)
  icon?: IconKey | null;
}

@FormSchema('space.update')
@InputType()
export class UpdateSpaceInput implements Omit<UpdateSpaceRequest, 'customFields'> {
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

  @Field(() => IconKeyEnum, { nullable: true })
  @IsClearable()
  @IsIn(ICON_KEYS)
  icon?: IconKey | null;

  @Field(() => SpaceStatusEnum, { nullable: true })
  @IsOmittable()
  @IsIn(SPACE_STATUSES)
  status?: SpaceStatus;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(SPACE_STATUS_NOTE_MAX)
  statusNote?: string;

  @Field(() => String, { nullable: true, description: 'yyyy-mm-dd; null clears it' })
  @IsClearable()
  @IsCalendarDate()
  startDate?: string | null;

  @Field(() => String, { nullable: true, description: 'yyyy-mm-dd; null clears it' })
  @IsClearable()
  @IsCalendarDate()
  @OnOrAfter('startDate')
  dueDate?: string | null;
}
