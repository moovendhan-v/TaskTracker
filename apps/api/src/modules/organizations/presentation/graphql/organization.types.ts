import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';
import type {
  OrganizationActivityResponse,
  OrganizationMemberResponse,
  OrganizationResponse,
  OrganizationSsoResponse,
  OrganizationWorkspaceResponse,
  OrgRole,
  TwoStepRequirement,
} from '@taskflow/shared-types';
import { JSONObjectScalar } from '../../../../core/graphql/json-object.scalar.js';

@ObjectType('Organization', { description: 'A group of workspaces run together (A3)' })
export class OrganizationGql implements OrganizationResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { description: "The caller's role: owner, admin or member" }) role: OrgRole;
  @Field(() => String, { description: 'Two-step sign-in required in all its workspaces: off, admins or everyone' }) twoStepRequired: TwoStepRequirement;
  @Field() createdAt: string;
}

@ObjectType('OrganizationMember')
export class OrganizationMemberGql implements OrganizationMemberResponse {
  @Field(() => ID) userId: string;
  @Field() name: string;
  @Field() email: string;
  @Field(() => String) role: OrgRole;
  @Field() hasTwoStep: boolean;
  @Field() joinedAt: string;
}

@ObjectType('OrganizationWorkspace')
export class OrganizationWorkspaceGql implements OrganizationWorkspaceResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() color: string;
}

@ObjectType('OrganizationActivity')
export class OrganizationActivityGql implements OrganizationActivityResponse {
  @Field(() => ID) id: string;
  @Field() action: string;
  @Field(() => String, { nullable: true }) actorName: string | null;
  @Field() targetType: string;
  @Field(() => JSONObjectScalar) metadata: Record<string, unknown>;
  @Field() createdAt: string;
}

@ObjectType('WorkspaceOrganization', { description: 'The organization a workspace is in' })
export class WorkspaceOrganizationGql {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String) twoStepRequired: TwoStepRequirement;
}

@ObjectType('SsoDnsRecord', { description: 'A TXT record to add to the domain, proving the organization owns it' })
export class SsoDnsRecordGql {
  @Field() name: string;
  @Field() value: string;
}

@ObjectType('OrganizationSso', { description: 'Sign-in through the organization’s identity provider (OIDC); the client secret is never shown' })
export class OrganizationSsoGql implements OrganizationSsoResponse {
  @Field() domain: string;
  @Field() issuer: string;
  @Field() clientId: string;
  @Field({ description: 'The domain is proved; SSO works only then' }) verified: boolean;
  @Field(() => SsoDnsRecordGql, { nullable: true }) dnsRecord: SsoDnsRecordGql | null;
}

@InputType('OrganizationSsoInput')
export class OrganizationSsoInput {
  @Field({ description: 'Email domain, e.g. acme.com' }) @IsString() @MaxLength(253) domain: string;
  @Field({ description: 'Issuer URL, e.g. https://acme.okta.com' }) @IsString() @MaxLength(500) issuer: string;
  @Field() @IsString() @MaxLength(500) clientId: string;
  @Field() @IsString() @MaxLength(1000) clientSecret: string;
}
