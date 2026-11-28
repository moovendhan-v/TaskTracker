import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { INTAKE_LIMITS, type BugIntakeResponse, type BugShareResponse, type BugShareScope, type SaveBugIntakeRequest } from '@taskflow/shared-types';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

@ObjectType('BugIntake', { description: 'A project’s public feedback: the embeddable widget and the hosted portal' })
export class BugIntakeGql implements BugIntakeResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field({ description: 'Public by design: it goes in the <script> tag and the portal address' }) publicKey: string;
  @Field() title: string;
  @Field() intro: string;
  @Field(() => [String]) allowedOrigins: string[];
  @Field() widgetEnabled: boolean;
  @Field() portalEnabled: boolean;
  @Field() updatedAt: string;
}

@InputType()
export class SaveBugIntakeInput implements SaveBugIntakeRequest {
  @Field() @IsString() @MaxLength(INTAKE_LIMITS.title) title: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(INTAKE_LIMITS.intro) intro?: string | null;
  @Field(() => [String]) @IsArray() @ArrayMaxSize(INTAKE_LIMITS.origins) @IsString({ each: true }) @MaxLength(200, { each: true }) allowedOrigins: string[];
  @Field() @IsBoolean() widgetEnabled: boolean;
  @Field() @IsBoolean() portalEnabled: boolean;
}

@ObjectType('BugShare', { description: 'A read-only link to a report' })
export class BugShareGql implements BugShareResponse {
  @Field(() => ID) id: string;
  @Field(() => String, { description: 'full or status' }) scope: BugShareScope;
  @Field() createdAt: string;
  @Field() expiresAt: string;
  @Field(() => String, { nullable: true }) lastViewedAt: string | null;
  @Field(() => String, { nullable: true }) createdByName: string | null;
}

@ObjectType('CreatedBugShare')
export class CreatedBugShareGql {
  @Field(() => BugShareGql) share: BugShareGql;
  @Field({ description: 'Shown once; only a hash is kept' }) path: string;
}

