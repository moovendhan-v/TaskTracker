import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { CurrentUserResponse, PlatformRole } from '@taskflow/shared-types';
import { PlatformRoleEnum } from '../../../../core/graphql/enums.js';

@ObjectType('CurrentUser')
export class CurrentUserGql implements CurrentUserResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() email: string;
  @Field(() => String, { nullable: true }) image: string | null;
  @Field(() => PlatformRoleEnum) platformRole: PlatformRole;
  @Field({ description: 'Teammates can only add you to a workspace once your email is confirmed' }) emailVerified: boolean;
}
