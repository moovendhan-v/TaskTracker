import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { isLayoutPage, type LayoutPage } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { LayoutsService } from '../../application/layouts.service.js';
import { DashboardLayoutGql, SaveLayoutInput } from './layout.types.js';

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
    return this.layouts.get(access.workspaceId, actor.userId, page(pageKey));
  }

  @Mutation(() => DashboardLayoutGql, { description: 'Saves your layout. Fails with CONFLICT if it changed since baseVersion' })
  @RequirePermissions('task.view')
  saveLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: SaveLayoutInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DashboardLayoutGql> {
    return this.layouts.save(access.workspaceId, actor.userId, input.pageKey, input.baseVersion ?? null, input.items);
  }

  @Mutation(() => Boolean, { description: 'Back to the built-in layout for a page' })
  @RequirePermissions('task.view')
  resetLayout(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('pageKey') pageKey: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    return this.layouts.reset(access.workspaceId, actor.userId, page(pageKey));
  }
}
