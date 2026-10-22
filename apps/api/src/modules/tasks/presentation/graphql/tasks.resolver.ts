import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { cappedListComplexity, pagedComplexity } from '../../../../core/graphql/page.type.js';
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
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskGql> {
    return this.tasksService.update(access, taskId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.delete')
  async deleteTask(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.tasksService.remove(access.workspaceId, taskId);
    return true;
  }
}
