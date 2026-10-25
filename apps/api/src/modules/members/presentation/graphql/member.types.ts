import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsUUID, MaxLength } from 'class-validator';
import type { AddMemberRequest, MemberResponse } from '@taskflow/shared-types';
import { PageOf } from '../../../../core/graphql/page.type.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { SensitiveField } from '../../../../core/access/sensitive-field.decorator.js';

@ObjectType('Member')
export class MemberGql implements MemberResponse {
  @Field(() => ID) userId: string;
  @Field() name: string;
  @SensitiveField('member.email', () => String) email: string | null;
  @Field(() => ID) roleId: string;
  @Field() roleName: string;
  @Field() joinedAt: string;
}

@ObjectType('MemberPage')
export class MemberPageGql extends PageOf(MemberGql) {}

@ObjectType('AddMemberResult')
export class AddMemberResultGql {
  @Field({ description: 'Same answer whether or not the email has an account' }) message: string;
}

@FormSchema('member.add')
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
