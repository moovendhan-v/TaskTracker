import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { GithubConnectionsService } from '../../application/github-connections.service.js';
import { ConnectGithubInput, GithubConnectionGql, GithubInboxPullRequestGql, GithubSecretGql, GithubSyncEventGql, PullRequestLinkGql, UpdateGithubConnectionInput } from './github.types.js';

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

  @Query(() => [GithubSyncEventGql], { description: 'What the latest webhook deliveries did, newest first' })
  @RequirePermissions('integration.manage')
  githubSyncLog(@WorkspaceIdArg() _workspaceId: string, @UuidArg('connectionId') connectionId: string, @CurrentAccess() access: WorkspaceAccess): Promise<GithubSyncEventGql[]> {
    return this.connections.syncLog(access.workspaceId, connectionId);
  }

  @Query(() => [GithubInboxPullRequestGql], { description: 'Pull requests that mention no task' })
  @RequirePermissions('integration.manage')
  githubPullRequestInbox(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<GithubInboxPullRequestGql[]> {
    return this.connections.inbox(access.workspaceId);
  }

  @Mutation(() => GithubInboxPullRequestGql, { description: 'Links an inbox pull request to a task by number (you must be able to edit the task)' })
  @RequirePermissions('integration.manage')
  linkInboxPullRequest(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('itemId') itemId: string,
    @Args('taskNumber', { type: () => Int }) taskNumber: number,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<GithubInboxPullRequestGql> {
    if (!Number.isInteger(taskNumber) || taskNumber < 1) throw DomainError.invalid('Enter a task number');
    return this.connections.linkFromInbox(actor, access, itemId, taskNumber);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('integration.manage')
  dismissInboxPullRequest(@WorkspaceIdArg() _workspaceId: string, @UuidArg('itemId') itemId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.connections.dismissFromInbox(actor, access, itemId);
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
