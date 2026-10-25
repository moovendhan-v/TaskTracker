import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, Matches, MaxLength } from 'class-validator';
import { COLOR_PATTERN, NAME_MAX, type CreateSpaceRequest, type SpaceResponse, type UpdateSpaceRequest } from '@taskflow/shared-types';
import { IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('Space')
export class SpaceGql implements SpaceResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) workspaceId: string;
  @Field() name: string;
  @Field() color: string;
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
}

@FormSchema('space.update')
@InputType()
export class UpdateSpaceInput implements UpdateSpaceRequest {
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
