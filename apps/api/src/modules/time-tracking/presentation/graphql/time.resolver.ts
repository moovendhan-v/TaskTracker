import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TIME_LIMITS } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { cappedListComplexity } from '../../../../core/graphql/page.type.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { TimeTrackingService } from '../../application/time-tracking.service.js';
import { LogTimeBatchInput, LogTimeInput, StartTimerInput, TaskTimeSummaryGql, TimeEntryGql, TimeEntryQueryInput, UpdateTimeEntryInput } from './time.types.js';

@Resolver(() => TimeEntryGql)
export class TimeResolver {
  constructor(private readonly time: TimeTrackingService) {}

  @Query(() => TimeEntryGql, { nullable: true, description: "The caller's running timer" })
  @RequirePermissions('time.log')
  runningTimer(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TimeEntryGql | null> {
    return this.time.running(access.workspaceId, actor.userId);
  }

  @Query(() => [TimeEntryGql], {
    complexity: cappedListComplexity(TIME_LIMITS.listMax / 10),
    description: `Entries started in [from, to), oldest first, at most ${TIME_LIMITS.listMax}. Without time.view_all, only your own.`,
  })
  @RequirePermissions('time.log')
  timeEntries(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('query') query: TimeEntryQueryInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TimeEntryGql[]> {
    return this.time.list(access, actor.userId, query);
  }

  @Query(() => TaskTimeSummaryGql)
  @RequirePermissions('task.view')
  taskTimeSummary(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TaskTimeSummaryGql> {
    return this.time.taskSummary(access.workspaceId, actor.userId, taskId);
  }

  @Mutation(() => TimeEntryGql, { description: 'Starts a timer; a timer already running is stopped first' })
  @RequirePermissions('time.log')
  startTimer(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: StartTimerInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TimeEntryGql> {
    return this.time.start(actor, access, input);
  }

  @Mutation(() => TimeEntryGql)
  @RequirePermissions('time.log')
  stopTimer(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TimeEntryGql> {
    return this.time.stop(actor, access);
  }

  @Mutation(() => TimeEntryGql)
  @RequirePermissions('time.log')
  logTime(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: LogTimeInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TimeEntryGql> {
    return this.time.log(actor, access, input);
  }

  @Mutation(() => [TimeEntryGql], { description: 'Saves a daily log: several entries, all or none, at most 24 hours in total' })
  @RequirePermissions('time.log')
  logTimeBatch(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: LogTimeBatchInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TimeEntryGql[]> {
    return this.time.logMany(actor, access, input.entries);
  }

  @Mutation(() => TimeEntryGql, { description: "Your own entries need time.log; anyone else's need time.manage" })
  @RequirePermissions('time.log')
  updateTimeEntry(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('entryId') entryId: string,
    @Args('input') input: UpdateTimeEntryInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TimeEntryGql> {
    return this.time.update(actor, access, entryId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('time.log')
  async deleteTimeEntry(@WorkspaceIdArg() _workspaceId: string, @UuidArg('entryId') entryId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.time.remove(actor, access, entryId);
    return true;
  }
}
