import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { cappedListComplexity, pagedComplexity } from '../../../../core/graphql/page.type.js';
import { resourceQueryComplexity } from '../../../../core/graphql/resource-query.types.js';
import type { NormalizedQuery } from '../../../../core/query/normalize-query.js';
import { ResourceQueryArg, ValidatedQuery } from '../../../../core/query/resource-query.decorator.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { TasksService } from '../../application/tasks.service.js';
import { CreateTaskInput, TaskGql, TaskListArgs, TaskPageGql, UpdateTaskInput } from './task.types.js';

/** Sprint and backlog views return at most this many tasks (see TasksService). */
const PLANNING_VIEW_LIMIT = 200;

@Resolver(() => TaskGql)
export class TasksResolver {
  constructor(private readonly tasksService: TasksService) {}

  @Query(() => TaskPageGql, { complexity: pagedComplexity })
  @RequirePermissions('task.view')
  tasks(@Args() args: TaskListArgs, @CurrentAccess() access: WorkspaceAccess): Promise<TaskPageGql> {
    const { listId, status, search, page, pageSize } = args;
    return this.tasksService.listInList(access.workspaceId, listId, { status, search, page, pageSize });
  }

  @Query(() => TaskPageGql, {
    complexity: resourceQueryComplexity,
    description: 'Tasks matching filters, sort and paging; see resourceSchema(resource: "tasks"). Optionally limited to a list or a space.',
  })
  @RequirePermissions('task.view')
  searchTasks(
    @WorkspaceIdArg() _workspaceId: string,
    @OptionalUuidArg('listId') listId: string | null,
    @OptionalUuidArg('spaceId') spaceId: string | null,
    @ResourceQueryArg() _query: unknown,
    @ValidatedQuery('tasks') query: NormalizedQuery,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskPageGql> {
    return this.tasksService.search(access.workspaceId, { listId: listId ?? undefined, spaceId: spaceId ?? undefined }, query);
  }

  @Query(() => TaskGql)
  @RequirePermissions('task.view')
  task(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskGql> {
    return this.tasksService.get(access.workspaceId, taskId);
  }

  @Query(() => [TaskGql], { complexity: cappedListComplexity(PLANNING_VIEW_LIMIT) })
  @RequirePermissions('task.view')
  sprintTasks(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('sprintId') sprintId: string,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskGql[]> {
    return this.tasksService.listInSprint(access.workspaceId, sprintId);
  }

  @Query(() => [TaskGql], { complexity: cappedListComplexity(PLANNING_VIEW_LIMIT), description: "Unfinished tasks in a space that aren't in a sprint" })
  @RequirePermissions('task.view')
  backlog(@WorkspaceIdArg() _workspaceId: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskGql[]> {
    return this.tasksService.backlog(access.workspaceId, spaceId);
  }

  @Mutation(() => TaskGql)
  @RequirePermissions('task.create')
  createTask(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('listId') listId: string,
    @Args('input') input: CreateTaskInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskGql> {
    return this.tasksService.create(actor, access, listId, input);
  }

  @Mutation(() => TaskGql)
  @RequirePermissions('task.update')
  updateTask(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('taskId') taskId: string,
    @Args('input') input: UpdateTaskInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskGql> {
    return this.tasksService.update(actor, access, taskId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.delete')
  async deleteTask(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('taskId') taskId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.tasksService.remove(actor, access.workspaceId, taskId);
    return true;
  }
}
