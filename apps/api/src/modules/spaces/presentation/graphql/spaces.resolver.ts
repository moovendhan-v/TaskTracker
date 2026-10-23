import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { SpacesService } from '../../application/spaces.service.js';
import { CreateSpaceInput, SpaceGql, UpdateSpaceInput } from './space.types.js';

@Resolver(() => SpaceGql)
export class SpacesResolver {
  constructor(private readonly spacesService: SpacesService) {}

  @Query(() => [SpaceGql])
  @RequirePermissions()
  spaces(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<SpaceGql[]> {
    return this.spacesService.list(access.workspaceId);
  }

  @Mutation(() => SpaceGql)
  @RequirePermissions('space.manage')
  createSpace(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: CreateSpaceInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SpaceGql> {
    return this.spacesService.create(actor, access.workspaceId, input);
  }

  @Mutation(() => SpaceGql)
  @RequirePermissions('space.manage')
  updateSpace(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('input') input: UpdateSpaceInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SpaceGql> {
    return this.spacesService.update(actor, access.workspaceId, spaceId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('space.manage')
  async deleteSpace(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.spacesService.remove(actor, access.workspaceId, spaceId);
    return true;
  }
}
