import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { ChecklistsService } from '../../application/checklists.service.js';
import { ChecklistItemGql, UpdateChecklistItemInput } from './checklist.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** Task checklists. Seeing them needs task.view (and the task); changing them, task.update in its space. */
@Resolver(() => ChecklistItemGql)
export class ChecklistsResolver {
  constructor(private readonly service: ChecklistsService) {}

  @Query(() => [ChecklistItemGql], { description: "The task's checklist, in order" })
  @RequirePermissions('task.view')
  taskChecklist(@WorkspaceIdArg() _w: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<ChecklistItemGql[]> {
    return this.service.list(access, taskId);
  }

  @Mutation(() => ChecklistItemGql, { description: 'Adds a step at the end of the task checklist' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(120))
  addChecklistItem(@WorkspaceIdArg() _w: string, @UuidArg('taskId') taskId: string, @Args('title') title: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChecklistItemGql> {
    return this.service.add(actor, access, taskId, title);
  }

  @Mutation(() => ChecklistItemGql, { description: 'Renames a step, or ticks / unticks it' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(240))
  updateChecklistItem(
    @WorkspaceIdArg() _w: string,
    @UuidArg('itemId') itemId: string,
    @Args('input') input: UpdateChecklistItemInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChecklistItemGql> {
    return this.service.update(actor, access, itemId, input);
  }

  @Mutation(() => [ChecklistItemGql], { description: 'Moves a step before another (or to the end); returns the checklist in its new order' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(240))
  moveChecklistItem(
    @WorkspaceIdArg() _w: string,
    @UuidArg('itemId') itemId: string,
    @OptionalUuidArg('beforeId', 'The step it goes before; omit for the end') beforeId: string | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChecklistItemGql[]> {
    return this.service.move(actor, access, itemId, beforeId);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  deleteChecklistItem(@WorkspaceIdArg() _w: string, @UuidArg('itemId') itemId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.remove(actor, access, itemId);
  }
}
