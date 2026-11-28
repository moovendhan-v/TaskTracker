import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ApiTokenClient } from '@taskflow/shared-types';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { ApiTokensService, toResponse } from '../../application/api-tokens.service.js';
import { ApiTokenGql, CreatedApiTokenGql } from './api-tokens.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** Your own connections in a workspace. Any member may connect; a token never does more than its owner may. */
@Resolver(() => ApiTokenGql)
export class ApiTokensResolver {
  constructor(private readonly service: ApiTokensService) {}

  @Query(() => [ApiTokenGql], { description: 'Your connected browser extensions and other clients in this workspace' })
  @RequirePermissions()
  apiTokens(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ApiTokenGql[]> {
    return this.service.list(actor, access);
  }

  @Mutation(() => ApiTokenGql, { description: 'Lets the browser extension that opened this page act as you here (it picks up its token within 10 minutes)' })
  @RequirePermissions()
  @Throttle(PER_MINUTE(10))
  approveExtensionConnection(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('challenge') challenge: string,
    @Args('name') name: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ApiTokenGql> {
    return this.service.approve(actor, access, { challenge, name });
  }

  @Mutation(() => Boolean, { description: 'Disconnects a client at once' })
  @RequirePermissions()
  @Throttle(PER_MINUTE(30))
  revokeApiToken(@WorkspaceIdArg() _workspaceId: string, @UuidArg('tokenId') tokenId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.revoke(actor, access, tokenId);
  }

  @Mutation(() => CreatedApiTokenGql, { description: 'A personal access token for an AI assistant (MCP) or a script, shown once' })
  @RequirePermissions()
  @Throttle(PER_MINUTE(10))
  async createApiToken(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('name') name: string,
    @Args('client') client: string,
    @Args('scopes', { type: () => [String] }) scopes: string[],
    @Args('days', { type: () => Int, nullable: true }) days: number | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CreatedApiTokenGql> {
    if (client !== 'mcp' && client !== 'script') throw DomainError.invalid('Unknown client');
    const issued = await this.service.createDirect(actor, access, { name, client: client as ApiTokenClient, scopes, days });
    return { token: issued.token, apiToken: toResponse(issued.record) };
  }
}
