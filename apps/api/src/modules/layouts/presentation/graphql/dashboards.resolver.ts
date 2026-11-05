import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { DashboardsService } from '../../application/dashboards.service.js';
import { CreateDashboardInput, DashboardTeamGql, NamedDashboardGql, SaveDashboardLayoutInput, UpdateDashboardInput } from './layout.types.js';

/** Home dashboard tabs. Same access as the dashboard itself; ownership is checked per dashboard. */
@Resolver(() => NamedDashboardGql)
export class DashboardsResolver {
  constructor(private readonly service: DashboardsService) {}

  @Query(() => [NamedDashboardGql], { description: 'Your dashboards, and the ones shared with the workspace or with a team you are in' })
  @RequirePermissions('task.view')
  dashboards(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<NamedDashboardGql[]> {
    return this.service.list(access.workspaceId, actor.userId);
  }

  @Query(() => [DashboardTeamGql], { description: 'Departments you belong to or lead: the teams you can share a dashboard with' })
  @RequirePermissions('task.view')
  dashboardTeams(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<DashboardTeamGql[]> {
    return this.service.teams(access.workspaceId, actor.userId);
  }

  @Mutation(() => NamedDashboardGql)
  @RequirePermissions('task.view')
  createDashboard(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: CreateDashboardInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<NamedDashboardGql> {
    return this.service.create(access.workspaceId, actor.userId, input);
  }

  @Mutation(() => NamedDashboardGql, { description: 'Rename, share / unshare, or set the date range of one of your dashboards' })
  @RequirePermissions('task.view')
  updateDashboard(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('dashboardId') dashboardId: string,
    @Args('input') input: UpdateDashboardInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<NamedDashboardGql> {
    return this.service.update(access.workspaceId, actor.userId, dashboardId, input);
  }

  @Mutation(() => NamedDashboardGql, { description: 'Saves the blocks of one of your dashboards. Fails with CONFLICT if it changed since baseVersion' })
  @RequirePermissions('task.view')
  saveDashboardLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('dashboardId') dashboardId: string,
    @Args('input') input: SaveDashboardLayoutInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<NamedDashboardGql> {
    return this.service.saveLayout(access.workspaceId, actor.userId, dashboardId, input.baseVersion, input.items);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.view')
  deleteDashboard(@WorkspaceIdArg() _workspaceId: string, @UuidArg('dashboardId') dashboardId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.remove(access.workspaceId, actor.userId, dashboardId);
  }
}
