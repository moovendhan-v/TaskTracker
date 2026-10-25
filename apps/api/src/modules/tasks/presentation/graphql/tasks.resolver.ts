import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PLANNING_VIEW_LIMIT, TASK_RELATION_KINDS, type TaskRelationKind } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { TaskRelationKindEnum } from '../../../../core/graphql/enums.js';
import { cappedListComplexity } from '../../../../core/graphql/page.type.js';
import { resourceQueryComplexity } from '../../../../core/graphql/resource-query.types.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import type { NormalizedQuery } from '../../../../core/query/normalize-query.js';
import { ResourceQueryArg, ValidatedQuery } from '../../../../core/query/resource-query.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { TasksService } from '../../application/tasks.service.js';
import { CreateTaskInput, TaskActivityGql, TaskGql, TaskPageGql, TaskRelationGql, UpdateTaskInput } from './task.types.js';


@Resolver(() => TaskGql)
export class TasksResolver {
  constructor(private readonly tasksService: TasksService) {}

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

  @Query(() => TaskGql, { description: 'A task by its short number, e.g. 978 for #978' })
  @RequirePermissions('task.view')
  taskByNumber(@WorkspaceIdArg() _workspaceId: string, @Args('number', { type: () => Int }) number: number, @CurrentAccess() access: WorkspaceAccess): Promise<TaskGql> {
    if (!Number.isInteger(number) || number < 1) throw DomainError.notFound('Task');
    return this.tasksService.getByNumber(access.workspaceId, number);
  }

  @Query(() => [TaskGql], { complexity: cappedListComplexity(PLANNING_VIEW_LIMIT) })
  @RequirePermissions('task.view')
  subtasks(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskGql[]> {
    return this.tasksService.subtasks(access.workspaceId, taskId);
  }

  @Query(() => [TaskGql], { complexity: cappedListComplexity(PLANNING_VIEW_LIMIT) })
  @RequirePermissions('task.view')
  sprintTasks(@WorkspaceIdArg() _workspaceId: string, @UuidArg('sprintId') sprintId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskGql[]> {
    return this.tasksService.listInSprint(access.workspaceId, sprintId);
  }

  @Query(() => [TaskGql], { complexity: cappedListComplexity(PLANNING_VIEW_LIMIT), description: "Unfinished tasks in a space that aren't in a sprint" })
  @RequirePermissions('task.view')
  backlog(@WorkspaceIdArg() _workspaceId: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskGql[]> {
    return this.tasksService.backlog(access.workspaceId, spaceId);
  }

  @Query(() => [TaskRelationGql])
  @RequirePermissions('task.view')
  taskRelations(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskRelationGql[]> {
    return this.tasksService.listRelations(access.workspaceId, taskId);
  }

  @Query(() => [TaskActivityGql], { description: "What changed on a task, newest first" })
  @RequirePermissions('task.view')
  taskActivity(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskActivityGql[]> {
    return this.tasksService.listActivity(access.workspaceId, taskId);
  }

  @Query(() => [ID], { description: 'Users following the task' })
  @RequirePermissions('task.view')
  taskWatchers(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<string[]> {
    return this.tasksService.listWatchers(access.workspaceId, taskId);
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

  @Mutation(() => Boolean, { description: 'Deletes the task and its subtasks' })
  @RequirePermissions('task.delete')
  async deleteTask(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.tasksService.remove(actor, access.workspaceId, taskId);
    return true;
  }

  @Mutation(() => [ID], { description: 'Follow (true) or stop following (false) a task' })
  @RequirePermissions('task.view')
  watchTask(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('taskId') taskId: string,
    @Args('watching') watching: boolean,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<string[]> {
    return this.tasksService.setWatching(actor, access.workspaceId, taskId, watching);
  }

  @Mutation(() => [TaskRelationGql])
  @RequirePermissions('task.update')
  relateTasks(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('taskId') taskId: string,
    @UuidArg('relatedTaskId') relatedTaskId: string,
    @Args('kind', { type: () => TaskRelationKindEnum }) kind: TaskRelationKind,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskRelationGql[]> {
    if (!TASK_RELATION_KINDS.includes(kind)) throw DomainError.invalid('Unknown relation');
    return this.tasksService.addRelation(actor, access.workspaceId, taskId, relatedTaskId, kind);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  unrelateTasks(@WorkspaceIdArg() _workspaceId: string, @UuidArg('relationId') relationId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.tasksService.removeRelation(actor, access.workspaceId, relationId);
  }
}
