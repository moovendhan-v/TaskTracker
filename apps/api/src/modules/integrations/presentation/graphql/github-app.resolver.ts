import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { GithubAppService } from '../../application/github-app.service.js';
import { ConnectGithubRepositoryInput, GithubAppInfoGql, GithubConnectionGql, GithubInstallationGql, GithubIssueLinkGql, GithubIssueRepositoryGql } from './github.types.js';

/** The TaskFlow GitHub App in a workspace (E2): install, choose repositories, issues for tasks. */
@Resolver()
export class GithubAppResolver {
  constructor(private readonly apps: GithubAppService) {}

  @Query(() => GithubAppInfoGql)
  @RequirePermissions('integration.manage')
  githubApp(@WorkspaceIdArg() _workspaceId: string): GithubAppInfoGql {
    return this.apps.info();
  }

  @Mutation(() => String, { description: 'Where to send you to install the app on GitHub for this workspace; the link works for ten minutes, for you only' })
  @RequirePermissions('integration.manage')
  githubAppInstallUrl(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): string {
    return this.apps.installUrl(actor, access);
  }

  @Query(() => [GithubInstallationGql])
  @RequirePermissions('integration.manage')
  githubInstallations(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<GithubInstallationGql[]> {
    return this.apps.installations(access.workspaceId);
  }

  @Query(() => [String], { description: 'Repositories (owner/name) the installation can reach, as GitHub says now' })
  @RequirePermissions('integration.manage')
  githubInstallationRepositories(@WorkspaceIdArg() _workspaceId: string, @UuidArg('installationId') installationId: string, @CurrentAccess() access: WorkspaceAccess): Promise<string[]> {
    return this.apps.repositories(access.workspaceId, installationId);
  }

  @Mutation(() => GithubConnectionGql, { description: 'Connects a repository through the app; linked tasks are moved as you' })
  @RequirePermissions('integration.manage')
  connectGithubRepository(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: ConnectGithubRepositoryInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<GithubConnectionGql> {
    return this.apps.connect(actor, access, input);
  }

  @Mutation(() => Boolean, { description: 'Forgets an installation here, with its repositories; it stays installed on GitHub' })
  @RequirePermissions('integration.manage')
  removeGithubInstallation(@WorkspaceIdArg() _workspaceId: string, @UuidArg('installationId') installationId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.apps.removeInstallation(actor, access, installationId);
  }

  @Query(() => [GithubIssueRepositoryGql], { description: 'Repositories where issues can be opened for tasks' })
  @RequirePermissions('task.view')
  githubIssueRepositories(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<GithubIssueRepositoryGql[]> {
    return this.apps.issueRepositories(access.workspaceId);
  }

  @Query(() => [GithubIssueLinkGql], { description: "The task's GitHub issues" })
  @RequirePermissions('task.view')
  taskGithubIssues(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<GithubIssueLinkGql[]> {
    return this.apps.issuesForTask(access.workspaceId, taskId);
  }

  @Mutation(() => GithubIssueLinkGql, { description: 'Opens a GitHub issue for the task and links them (needs edit rights on the task)' })
  // Edit rights are checked in the task's space by the service.
  @RequirePermissions('task.view')
  createGithubIssue(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('taskId') taskId: string,
    @UuidArg('connectionId') connectionId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<GithubIssueLinkGql> {
    return this.apps.createIssue(actor, access, taskId, connectionId);
  }
}
