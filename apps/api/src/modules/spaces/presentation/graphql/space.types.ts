import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { COLOR_PATTERN, NAME_MAX, type CreateSpaceRequest, type SpaceResponse, type UpdateSpaceRequest } from '@taskflow/shared-types';
import { IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('Space')
export class SpaceGql implements SpaceResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) workspaceId: string;
  @Field() name: string;
  @Field() color: string;
  @Field() createdAt: string;
}

@InputType()
export class CreateSpaceInput implements CreateSpaceRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOmittable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}

@InputType()
export class UpdateSpaceInput implements UpdateSpaceRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}
