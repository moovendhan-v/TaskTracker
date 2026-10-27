import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { GithubConnectionsService } from '../../application/github-connections.service.js';
import { ConnectGithubInput, GithubConnectionGql, GithubSecretGql, PullRequestLinkGql, UpdateGithubConnectionInput } from './github.types.js';

@Resolver(() => GithubConnectionGql)
export class GithubResolver {
  constructor(private readonly connections: GithubConnectionsService) {}

  @Query(() => [GithubConnectionGql])
  @RequirePermissions('integration.manage')
  githubConnections(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<GithubConnectionGql[]> {
    return this.connections.list(access.workspaceId);
  }

  @Query(() => [PullRequestLinkGql], { description: 'Pull requests that mention the task' })
  @RequirePermissions('task.view')
  taskPullRequests(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<PullRequestLinkGql[]> {
    return this.connections.linksForTask(access.workspaceId, taskId);
  }

  @Mutation(() => GithubSecretGql)
  @RequirePermissions('integration.manage')
  connectGithub(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: ConnectGithubInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<GithubSecretGql> {
    return this.connections.create(actor, access, input);
  }

  @Mutation(() => GithubConnectionGql, { description: 'Saving takes the connection over: tasks are then moved as you' })
  @RequirePermissions('integration.manage')
  updateGithubConnection(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('connectionId') connectionId: string,
    @Args('input') input: UpdateGithubConnectionInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<GithubConnectionGql> {
    return this.connections.update(actor, access, connectionId, input);
  }

  @Mutation(() => GithubSecretGql, { description: 'A new webhook secret; the old one stops working at once' })
  @RequirePermissions('integration.manage')
  rotateGithubSecret(@WorkspaceIdArg() _workspaceId: string, @UuidArg('connectionId') connectionId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<GithubSecretGql> {
    return this.connections.rotateSecret(actor, access, connectionId);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('integration.manage')
  async disconnectGithub(@WorkspaceIdArg() _workspaceId: string, @UuidArg('connectionId') connectionId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.connections.remove(actor, access, connectionId);
    return true;
  }
}
