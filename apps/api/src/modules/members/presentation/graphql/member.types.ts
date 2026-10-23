import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsUUID, MaxLength } from 'class-validator';
import type { AddMemberRequest, MemberResponse } from '@taskflow/shared-types';

@ObjectType('Member')
export class MemberGql implements MemberResponse {
  @Field(() => ID) userId: string;
  @Field() name: string;
  @Field() email: string;
  @Field(() => ID) roleId: string;
  @Field() roleName: string;
  @Field() joinedAt: string;
}

@ObjectType('AddMemberResult')
export class AddMemberResultGql {
  @Field({ description: 'Same answer whether or not the email has an account' }) message: string;
}

@InputType()
export class AddMemberInput implements AddMemberRequest {
  @Field()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Field(() => ID)
  @IsUUID('4')
  roleId: string;
}
