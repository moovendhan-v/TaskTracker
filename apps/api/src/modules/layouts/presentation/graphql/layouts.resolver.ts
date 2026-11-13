import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { isLayoutPage, type LayoutPage } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { LayoutsService } from '../../application/layouts.service.js';
import { DashboardLayoutGql, LayoutVersionGql, SaveLayoutInput, SetTeamLayoutInput, SetWorkspaceLayoutInput, TeamLayoutGql, TeamLayoutTargetGql, WorkspaceLayoutGql } from './layout.types.js';

function page(value: string): LayoutPage {
  if (!isLayoutPage(value)) throw DomainError.invalid('Unknown page');
  return value;
}

/** Personal page layouts. Same access as the dashboards they arrange; always the caller's own. */
@Resolver(() => DashboardLayoutGql)
export class LayoutsResolver {
  constructor(private readonly layouts: LayoutsService) {}

  @Query(() => DashboardLayoutGql, { nullable: true, description: 'Your saved layout for a page; null means the built-in default' })
  @RequirePermissions('task.view')
  myLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('pageKey') pageKey: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DashboardLayoutGql | null> {
    return this.layouts.get(access.workspaceId, actor.userId, page(pageKey), access.permissions.has('layout.manage'));
  }

  @Mutation(() => DashboardLayoutGql, { description: 'Saves your layout. Fails with CONFLICT if it changed since baseVersion' })
  @RequirePermissions('task.view')
  saveLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: SaveLayoutInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DashboardLayoutGql> {
    return this.layouts.save(access.workspaceId, actor.userId, input.pageKey, input.baseVersion ?? null, input.items, access.permissions.has('layout.manage'));
  }

  @Mutation(() => Boolean, { description: "Drops your own layout for a page: you're back on the workspace default, or the built-in one" })
  @RequirePermissions('task.view')
  resetLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('pageKey') pageKey: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    return this.layouts.reset(access.workspaceId, actor.userId, page(pageKey));
  }

  @Query(() => [LayoutVersionGql], { description: 'Your recent saves of a page, newest first' })
  @RequirePermissions('task.view')
  myLayoutVersions(@WorkspaceIdArg() _workspaceId: string, @Args('pageKey') pageKey: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<LayoutVersionGql[]> {
    return this.layouts.versions(access.workspaceId, actor.userId, page(pageKey));
  }

  @Query(() => WorkspaceLayoutGql, { nullable: true, description: "The workspace's default for a page; null means the built-in layout" })
  @RequirePermissions('task.view')
  workspaceLayout(@WorkspaceIdArg() _workspaceId: string, @Args('pageKey') pageKey: string, @CurrentAccess() access: WorkspaceAccess): Promise<WorkspaceLayoutGql | null> {
    return this.layouts.workspaceDefault(access.workspaceId, page(pageKey));
  }

  @Mutation(() => WorkspaceLayoutGql, { description: 'Makes a layout the workspace default for a page (audited)' })
  @RequirePermissions('layout.manage')
  setWorkspaceLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: SetWorkspaceLayoutInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<WorkspaceLayoutGql> {
    return this.layouts.setWorkspaceDefault(actor, access.workspaceId, input.pageKey, input.items);
  }

  @Mutation(() => WorkspaceLayoutGql, { description: 'Locks the workspace default: everyone sees it, and only layout managers arrange the page (audited)' })
  @RequirePermissions('layout.manage')
  setWorkspaceLayoutLocked(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('pageKey') pageKey: string,
    @Args('locked') locked: boolean,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<WorkspaceLayoutGql> {
    return this.layouts.setWorkspaceDefaultLocked(actor, access.workspaceId, page(pageKey), locked);
  }

  @Mutation(() => Boolean, { description: 'Back to the built-in default for everyone who has not arranged the page (audited)' })
  @RequirePermissions('layout.manage')
  clearWorkspaceLayout(@WorkspaceIdArg() _workspaceId: string, @Args('pageKey') pageKey: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.layouts.clearWorkspaceDefault(actor, access.workspaceId, page(pageKey));
  }

  @Query(() => TeamLayoutGql, { nullable: true, description: "Your team's default for a page (your HR department's), if it has one" })
  @RequirePermissions('task.view')
  myTeamLayout(@WorkspaceIdArg() _workspaceId: string, @Args('pageKey') pageKey: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TeamLayoutGql | null> {
    return this.layouts.myTeamDefault(access.workspaceId, actor.userId, page(pageKey));
  }

  @Query(() => [TeamLayoutTargetGql], { description: 'Teams whose default you may set for a page (layout managers: all; department heads: theirs)' })
  @RequirePermissions('task.view')
  teamLayoutTargets(@WorkspaceIdArg() _workspaceId: string, @Args('pageKey') pageKey: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TeamLayoutTargetGql[]> {
    return this.layouts.teamTargets(access, actor.userId, page(pageKey));
  }

  @Mutation(() => TeamLayoutTargetGql, { description: "Makes a layout a team's starting point for a page (layout managers or the team's head; audited)" })
  // Who may is decided per team (layout.manage, or heading it) by the service.
  @RequirePermissions('task.view')
  setTeamLayout(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: SetTeamLayoutInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TeamLayoutTargetGql> {
    return this.layouts.setTeamDefault(actor, access, input.departmentId, input.pageKey, input.items);
  }

  @Mutation(() => Boolean, { description: "Removes a team's default for a page (layout managers or the team's head; audited)" })
  @RequirePermissions('task.view')
  clearTeamLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('departmentId') departmentId: string,
    @Args('pageKey') pageKey: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    return this.layouts.clearTeamDefault(actor, access, departmentId, page(pageKey));
  }
}
