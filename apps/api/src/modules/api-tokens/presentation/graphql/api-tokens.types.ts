import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { ApiTokenClient, ApiTokenResponse, ApiTokenScope } from '@taskflow/shared-types';

@ObjectType('ApiToken', { description: 'A connection (browser extension, MCP client) acting as you in this workspace; the token itself is never shown again' })
export class ApiTokenGql implements ApiTokenResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String) client: ApiTokenClient;
  @Field(() => [String]) scopes: ApiTokenScope[];
  @Field(() => String, { nullable: true, description: 'The first characters, to tell connections apart' }) prefix: string | null;
  @Field({ description: 'Approved, waiting for the extension to pick it up' }) pending: boolean;
  @Field() createdAt: string;
  @Field() expiresAt: string;
  @Field(() => String, { nullable: true }) lastUsedAt: string | null;
}

@ObjectType('CreatedApiToken')
export class CreatedApiTokenGql {
  @Field({ description: 'Shown once: only a hash is kept' }) token: string;
  @Field(() => ApiTokenGql) apiToken: ApiTokenGql;
}
