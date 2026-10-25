import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { AnalyticsService } from '../../application/analytics.service.js';
import { DashboardGql, DashboardInput } from './analytics.types.js';

@Resolver(() => DashboardGql)
export class AnalyticsResolver {
  constructor(private readonly analytics: AnalyticsService) {}

  @Query(() => DashboardGql, { description: 'Workspace or project (spaceId) dashboard: live task counts and hours for a window' })
  @RequirePermissions('task.view')
  dashboard(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: DashboardInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<DashboardGql> {
    return this.analytics.dashboard(access, actor.userId, input);
  }
}
