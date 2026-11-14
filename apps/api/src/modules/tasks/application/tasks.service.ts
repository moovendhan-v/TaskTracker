import { Injectable } from '@nestjs/common';
import {
  isClosedCategory,
  PLANNING_VIEW_LIMIT,
  type CreateTaskRequest,
  type Paginated,
  type SpaceScopedPermission,
  type TaskActivityResponse,
  type TaskRelationKind,
  type TaskRelationResponse,
  type TaskResponse,
  type UpdateTaskRequest,
} from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { domainEvent, type ChangeKind } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import { CustomFieldsService } from '../../custom-fields/application/custom-fields.service.js';
import { ListsService } from '../../lists/application/lists.service.js';
import { MembersService } from '../../members/application/members.service.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { SprintsService } from '../../sprints/application/sprints.service.js';
import { StatusesService } from '../../statuses/application/statuses.service.js';
import { describeChanges, type TaskChange } from '../domain/task-changes.js';
import { TaskActivityRepository, TaskRelationRepository, TaskWatcherRepository } from '../domain/task-extras.repository.js';
import { TaskStructurePolicy } from '../domain/task-structure.policy.js';
import { mergeMetadata, mergeValues, TASK_POSITION_STEP, type Task } from '../domain/task.js';
import { TaskAssignmentPolicy } from '../domain/task-assignment.policy.js';
import { TaskPlanningPolicy } from '../domain/task-planning.policy.js';
import { TaskRepository, type TaskSearchScope } from '../domain/task.repository.js';
import { TaskMapper, type TaskContext } from './task.mapper.js';

const ACTIVITY_LIMIT = 100;

@Injectable()
export class TasksService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly watchers: TaskWatcherRepository,
    private readonly relations: TaskRelationRepository,
    private readonly activity: TaskActivityRepository,
    private readonly listsService: ListsService,
    private readonly membersService: MembersService,
    private readonly spacesService: SpacesService,
    private readonly sprintsService: SprintsService,
    private readonly statusesService: StatusesService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly eventBus: EventBus,
  ) {}

  /** Tasks matching a validated resource query, optionally limited to a list or a space. */
  @Cached({ entities: ['task', 'list', 'status'], shared: true })
  async search(workspaceId: string, scope: TaskSearchScope, query: NormalizedQuery): Promise<Paginated<TaskResponse>> {
    if (scope.listId) await this.listsService.getInWorkspace(workspaceId, scope.listId);
    if (scope.spaceId) await this.spacesService.getInWorkspace(workspaceId, scope.spaceId);
    const result = await this.tasks.search(workspaceId, scope, query);
    return { items: await this.respond(workspaceId, result.items), total: result.total, page: query.page, pageSize: query.pageSize };
  }

  @Cached({ entities: ['task', 'sprint', 'status'], shared: true })
  async listInSprint(workspaceId: string, sprintId: string): Promise<TaskResponse[]> {
    await this.sprintsService.getInWorkspace(workspaceId, sprintId);
    return this.respond(workspaceId, await this.tasks.listInSprint(workspaceId, sprintId, PLANNING_VIEW_LIMIT));
  }

  /** Unfinished tasks of a space, e.g. to save the space as a template. */
  async openInSpace(workspaceId: string, spaceId: string, limit: number): Promise<TaskResponse[]> {
    return this.respond(workspaceId, await this.tasks.openInSpace(workspaceId, spaceId, limit));
  }

  @Cached({ entities: ['task', 'sprint', 'status'], shared: true })
  async backlog(workspaceId: string, spaceId: string): Promise<TaskResponse[]> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    return this.respond(workspaceId, await this.tasks.backlogInSpace(workspaceId, spaceId, PLANNING_VIEW_LIMIT));
  }

  @Cached({ entities: ['task', 'status'], shared: true })
  async get(workspaceId: string, taskId: string): Promise<TaskResponse> {
    return this.respondOne(workspaceId, await this.getInWorkspace(workspaceId, taskId));
  }

  @Cached({ entities: ['task', 'status'], shared: true })
  async getByNumber(workspaceId: string, number: number): Promise<TaskResponse> {
    return this.respondOne(workspaceId, found(await this.tasks.findByNumber(workspaceId, number), 'Task'));
  }

  @Cached({ entities: ['task', 'status'], shared: true })
  async subtasks(workspaceId: string, taskId: string): Promise<TaskResponse[]> {
    await this.getInWorkspace(workspaceId, taskId);
    return this.respond(workspaceId, await this.tasks.listSubtasks(workspaceId, taskId, PLANNING_VIEW_LIMIT));
  }

  /** Creates a task straight in a space (project), in its default list. */
  async createInSpace(actor: Actor, access: WorkspaceAccess, spaceId: string, request: CreateTaskRequest): Promise<TaskResponse> {
    const list = await this.listsService.defaultFor(actor, access.workspaceId, spaceId);
    return this.create(actor, access, list.id, request);
  }

  async create(actor: Actor, access: WorkspaceAccess, listId: string, request: CreateTaskRequest): Promise<TaskResponse> {
    const { workspaceId } = access;
    const list = await this.listsService.getInWorkspace(workspaceId, listId);
    SpaceGuard.assert(list.spaceId, 'task.create');
    let assigneeIds: string[] = [];
    if (request.assigneeIds !== undefined) {
      assigneeIds = Array.from(new Set(request.assigneeIds.filter((id): id is string => Boolean(id))));
    } else if (request.assigneeId) {
      assigneeIds = [request.assigneeId];
    }

    if (assigneeIds.length > 0) {
      SpaceGuard.assert(list.spaceId, 'task.assign');
      for (const uid of assigneeIds) {
        await this.assertAssignable(access, uid);
      }
    }
    if (request.parentId) {
      const parent = await this.getInWorkspace(workspaceId, request.parentId);
      TaskStructurePolicy.assertValidParent(listId, parent, await this.tasks.depthOf(workspaceId, parent.id));
    }
    const status = request.statusId
      ? await this.statusInSpace(workspaceId, request.statusId, list.spaceId)
      : await this.statusesService.defaultFor(workspaceId, list.spaceId);
    const startDate = toDate(request.startDate);
    const dueDate = toDate(request.dueDate);
    TaskStructurePolicy.assertDates(startDate, dueDate);
    const customFields = mergeValues({}, await this.customFieldsService.normalizePatch(workspaceId, 'task', list.spaceId, request.customFields ?? {}));

    const task = await this.tasks.create({
      workspaceId,
      number: await this.tasks.nextNumber(workspaceId),
      listId,
      parentId: request.parentId ?? null,
      type: request.type ?? 'task',
      title: request.title.trim(),
      description: request.description ?? '',
      statusId: status.id,
      priority: request.priority ?? 'none',
      startDate,
      dueDate,
      assigneeId: assigneeIds[0] ?? null,
      assigneeIds,
      sprintId: null,
      position: (await this.tasks.maxPosition(workspaceId, listId)) + TASK_POSITION_STEP,
      estimateMinutes: request.estimateMinutes ?? null,
      progress: null,
      metadata: mergeMetadata({}, request.metadata ?? {}),
      customFields,
      completedAt: isClosedCategory(status.category) ? new Date() : null,
      createdById: actor.userId,
    });
    await this.watchers.add(workspaceId, task.id, [actor.userId, ...assigneeIds].filter((id): id is string => !!id));
    await this.activity.record([{ workspaceId, taskId: task.id, actorId: actor.userId, kind: 'created', field: null, fromValue: null, toValue: null }]);
    await this.publish('created', actor, task, { spaceId: list.spaceId, statusCategory: status.category });
    return this.respondOne(workspaceId, task);
  }

  async update(actor: Actor, access: WorkspaceAccess, taskId: string, request: UpdateTaskRequest): Promise<TaskResponse> {
    const { workspaceId } = access;
    const before = await this.getInWorkspace(workspaceId, taskId);
    const task: Task = { ...before };
    const list = await this.listsService.getInWorkspace(workspaceId, task.listId);
    SpaceGuard.assert(list.spaceId, 'task.update');

    if (request.assigneeIds !== undefined) {
      SpaceGuard.assert(list.spaceId, 'task.assign');
      const uniqueAssigneeIds: string[] = Array.from(new Set(request.assigneeIds.filter((id): id is string => Boolean(id))));
      if (uniqueAssigneeIds.length === 0) {
        TaskAssignmentPolicy.assertCanChangeAssignee(access.permissions);
      } else {
        for (const uid of uniqueAssigneeIds) {
          await this.assertAssignable(access, uid);
        }
      }
      task.assigneeIds = uniqueAssigneeIds;
      task.assigneeId = uniqueAssigneeIds[0] ?? null;
    } else if (request.assigneeId !== undefined && request.assigneeId !== task.assigneeId) {
      SpaceGuard.assert(list.spaceId, 'task.assign');
      if (request.assigneeId === null) {
        TaskAssignmentPolicy.assertCanChangeAssignee(access.permissions);
        task.assigneeId = null;
        task.assigneeIds = [];
      } else {
        await this.assertAssignable(access, request.assigneeId);
        task.assigneeId = request.assigneeId;
        task.assigneeIds = [request.assigneeId];
      }
    }
    if (request.sprintId !== undefined && request.sprintId !== task.sprintId) {
      SpaceGuard.assert(list.spaceId, 'sprint.manage');
      await this.assertPlannable(access, task, request.sprintId);
      task.sprintId = request.sprintId;
    }
    let statusCategory: string | undefined;
    if (request.statusId !== undefined && request.statusId !== task.statusId) {
      const status = await this.statusInSpace(workspaceId, request.statusId, list.spaceId);
      const wasClosed = task.completedAt !== null;
      task.statusId = status.id;
      statusCategory = status.category;
      if (isClosedCategory(status.category) && !wasClosed) task.completedAt = new Date();
      if (!isClosedCategory(status.category)) task.completedAt = null;
    }
    if (request.title !== undefined) task.title = request.title.trim();
    if (request.description !== undefined) task.description = request.description;
    if (request.type !== undefined) task.type = request.type;
    if (request.priority !== undefined) task.priority = request.priority;
    if (request.startDate !== undefined) task.startDate = toDate(request.startDate);
    if (request.dueDate !== undefined) task.dueDate = toDate(request.dueDate);
    TaskStructurePolicy.assertDates(task.startDate, task.dueDate);
    if (request.estimateMinutes !== undefined) task.estimateMinutes = request.estimateMinutes;
    if (request.progress !== undefined) task.progress = request.progress;
    if (request.position !== undefined) task.position = request.position;
    if (request.metadata !== undefined) task.metadata = mergeMetadata(task.metadata, request.metadata);
    if (request.customFields !== undefined) {
      task.customFields = mergeValues(task.customFields, await this.customFieldsService.normalizePatch(workspaceId, 'task', list.spaceId, request.customFields));
    }

    const saved = await this.tasks.save(task);
    const changes = describeChanges(before, saved, await this.names(workspaceId));
    await this.activity.record(changes.map((change) => ({ workspaceId, taskId, actorId: actor.userId, kind: 'changed', field: change.field, fromValue: change.from, toValue: change.to })));
    const beforeList = before.assigneeIds?.length ? before.assigneeIds : (before.assigneeId ? [before.assigneeId] : []);
    const savedList = saved.assigneeIds?.length ? saved.assigneeIds : (saved.assigneeId ? [saved.assigneeId] : []);
    const newAssignees = savedList.filter((id) => !beforeList.includes(id));
    if (newAssignees.length > 0) await this.watchers.add(workspaceId, taskId, newAssignees);
    await this.publish('updated', actor, saved, { previousAssigneeId: before.assigneeId, changes, spaceId: list.spaceId, statusCategory });
    return this.respondOne(workspaceId, saved);
  }

  /**
   * Moves a task, with its subtasks, to the end of another list in the same space
   * (statuses, sprints and fields belong to the space, so they all stay valid).
   * Needs task.update in that space. A subtask moves with its parent, not alone.
   * Returns the task and whether it moved (false when it was already there).
   */
  async moveToList(actor: Actor, access: WorkspaceAccess, taskId: string, listId: string): Promise<{ task: TaskResponse; moved: boolean }> {
    const { workspaceId } = access;
    const task = await this.getInWorkspace(workspaceId, taskId);
    const from = await this.listsService.getInWorkspace(workspaceId, task.listId);
    SpaceGuard.assert(from.spaceId, 'task.update');
    if (task.listId === listId) return { task: await this.respondOne(workspaceId, task), moved: false };
    if (task.parentId) throw DomainError.invalid('A subtask moves with its parent task');
    const to = await this.listsService.getInWorkspace(workspaceId, listId);
    if (to.spaceId !== from.spaceId) throw DomainError.invalid('A task can move only to a list in its own space');

    await this.tasks.moveSubtree(workspaceId, taskId, to.id, (await this.tasks.maxPosition(workspaceId, to.id)) + TASK_POSITION_STEP);
    const saved = await this.getInWorkspace(workspaceId, taskId);
    const changes: TaskChange[] = [{ field: 'list', from: from.name, to: to.name }];
    await this.activity.record([{ workspaceId, taskId, actorId: actor.userId, kind: 'changed', field: 'list', fromValue: from.name.slice(0, 300), toValue: to.name.slice(0, 300) }]);
    await this.publish('updated', actor, saved, { changes, spaceId: to.spaceId });
    return { task: await this.respondOne(workspaceId, saved), moved: true };
  }

  /** Deletes the task and its subtasks. */
  async remove(actor: Actor, workspaceId: string, taskId: string): Promise<TaskResponse> {
    const task = await this.getInWorkspace(workspaceId, taskId);
    await this.assertInSpace(workspaceId, task, 'task.delete');
    const response = await this.respondOne(workspaceId, task);
    await this.tasks.delete(workspaceId, taskId);
    await this.publish('deleted', actor, task, {});
    return response;
  }

  /** The space a task sits in, for space-level checks in other modules. */
  async spaceIdOf(workspaceId: string, taskId: string): Promise<string> {
    const task = await this.getInWorkspace(workspaceId, taskId);
    return (await this.listsService.getInWorkspace(workspaceId, task.listId)).spaceId;
  }

  /** Who cares about a task: for notifying people about comments on it. */
  async participants(workspaceId: string, taskId: string): Promise<{ title: string; assigneeId: string | null; assigneeIds: string[]; createdById: string; watcherIds: string[] }> {
    const { title, assigneeId, assigneeIds, createdById } = await this.getInWorkspace(workspaceId, taskId);
    return { title, assigneeId, assigneeIds: assigneeIds ?? (assigneeId ? [assigneeId] : []), createdById, watcherIds: await this.watchers.list(workspaceId, taskId) };
  }

  async listWatchers(workspaceId: string, taskId: string): Promise<string[]> {
    await this.getInWorkspace(workspaceId, taskId);
    return this.watchers.list(workspaceId, taskId);
  }

  /** Makes someone watch a task (automations). Needs task.update in the task's space. */
  async addWatcher(actor: Actor, workspaceId: string, taskId: string, userId: string): Promise<string[]> {
    const task = await this.getInWorkspace(workspaceId, taskId);
    await this.assertInSpace(workspaceId, task, 'task.update');
    await this.watchers.add(workspaceId, taskId, [userId]);
    await this.publish('updated', actor, task, {});
    return this.watchers.list(workspaceId, taskId);
  }

  /** Follow or stop following a task. Anyone who can see it may watch it. */
  async setWatching(actor: Actor, workspaceId: string, taskId: string, watching: boolean): Promise<string[]> {
    const task = await this.getInWorkspace(workspaceId, taskId);
    if (watching) await this.watchers.add(workspaceId, taskId, [actor.userId]);
    else await this.watchers.remove(workspaceId, taskId, actor.userId);
    await this.publish('updated', actor, task, {});
    return this.watchers.list(workspaceId, taskId);
  }

  @Cached({ entities: ['task', 'status'], shared: true })
  async listRelations(workspaceId: string, taskId: string): Promise<TaskRelationResponse[]> {
    await this.getInWorkspace(workspaceId, taskId);
    const relations = await this.relations.listFor(workspaceId, taskId);
    const others = await this.tasks.findMany(workspaceId, relations.map((relation) => (relation.taskId === taskId ? relation.relatedTaskId : relation.taskId)));
    const responses = new Map((await this.respond(workspaceId, others)).map((task) => [task.id, task]));
    return relations.flatMap((relation) => {
      const outgoing = relation.taskId === taskId;
      const other = responses.get(outgoing ? relation.relatedTaskId : relation.taskId);
      return other ? [{ id: relation.id, kind: relation.kind, outgoing, task: { id: other.id, number: other.number, title: other.title, status: other.status } }] : [];
    });
  }

  async addRelation(actor: Actor, workspaceId: string, taskId: string, relatedTaskId: string, kind: TaskRelationKind): Promise<TaskRelationResponse[]> {
    TaskStructurePolicy.assertNotSelf(taskId, relatedTaskId);
    const task = await this.getInWorkspace(workspaceId, taskId);
    await this.assertInSpace(workspaceId, task, 'task.update');
    const related = await this.getInWorkspace(workspaceId, relatedTaskId);
    if (!(await this.relations.create({ workspaceId, taskId, relatedTaskId, kind, createdById: actor.userId }))) throw DomainError.conflict('Those tasks are already related that way');
    await this.activity.record([{ workspaceId, taskId, actorId: actor.userId, kind: 'related', field: kind, fromValue: null, toValue: `#${related.number}` }]);
    await this.publish('updated', actor, task, {});
    return this.listRelations(workspaceId, taskId);
  }

  async removeRelation(actor: Actor, workspaceId: string, relationId: string): Promise<boolean> {
    const relation = found(await this.relations.findInWorkspace(workspaceId, relationId), 'Relation');
    await this.assertInSpace(workspaceId, await this.getInWorkspace(workspaceId, relation.taskId), 'task.update');
    await this.relations.delete(workspaceId, relationId);
    await this.publish('updated', actor, await this.getInWorkspace(workspaceId, relation.taskId), {});
    return true;
  }

  @Cached({ entities: ['task'], shared: true })
  async listActivity(workspaceId: string, taskId: string): Promise<TaskActivityResponse[]> {
    await this.getInWorkspace(workspaceId, taskId);
    return (await this.activity.list(workspaceId, taskId, ACTIVITY_LIMIT)).map((entry) => ({
      id: entry.id,
      taskId: entry.taskId,
      actorId: entry.actorId,
      actorName: entry.actorName,
      kind: entry.kind,
      field: entry.field,
      from: entry.fromValue,
      to: entry.toValue,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  /** Builds responses for a batch of tasks with three lookups, whatever the batch size. */
  private async respond(workspaceId: string, tasks: readonly Task[]): Promise<TaskResponse[]> {
    const context: TaskContext = {
      statuses: await this.statusesService.byId(workspaceId),
      spaceOfList: new Map((await this.listsService.listForWorkspace(workspaceId)).map((list) => [list.id, list.spaceId])),
      subtaskCounts: await this.tasks.countSubtasks(workspaceId, tasks.map((task) => task.id)),
    };
    return tasks.map((task) => TaskMapper.toResponse(task, context));
  }

  private async respondOne(workspaceId: string, task: Task): Promise<TaskResponse> {
    return found((await this.respond(workspaceId, [task]))[0], 'Task');
  }

  private publish(change: ChangeKind, actor: Actor, task: Task, extra: { previousAssigneeId?: string | null; changes?: TaskChange[]; spaceId?: string; statusCategory?: string }): Promise<void> {
    return this.eventBus.publish(
      domainEvent('task', change, {
        workspaceId: task.workspaceId,
        entityId: task.id,
        actorId: actor.userId,
        facts: { title: task.title, assigneeId: task.assigneeId, createdById: task.createdById, number: task.number, listId: task.listId, ...extra },
      }),
    );
  }

  /** Applies the caller's space limits to a task's space. */
  private async assertInSpace(workspaceId: string, task: Task, permission: SpaceScopedPermission): Promise<void> {
    SpaceGuard.assert((await this.listsService.getInWorkspace(workspaceId, task.listId)).spaceId, permission);
  }

  private async getInWorkspace(workspaceId: string, taskId: string): Promise<Task> {
    return found(await this.tasks.findInWorkspace(workspaceId, taskId), 'Task');
  }

  private async statusInSpace(workspaceId: string, statusId: string, spaceId: string) {
    const status = await this.statusesService.getInWorkspace(workspaceId, statusId);
    if (status.spaceId !== spaceId) throw DomainError.invalid("That status belongs to another space; use one of this space's statuses");
    return status;
  }

  private async names(workspaceId: string): Promise<Parameters<typeof describeChanges>[2]> {
    const statuses = await this.statusesService.byId(workspaceId);
    const members = new Map((await this.membersService.list(workspaceId)).map((member) => [member.userId, member.name]));
    return { status: (id) => statuses.get(id)?.name ?? 'Unknown', user: (id) => (id ? (members.get(id) ?? 'Someone') : null) };
  }

  private async assertPlannable(access: WorkspaceAccess, task: Task, sprintId: string | null): Promise<void> {
    TaskPlanningPolicy.assertCanPlan(access.permissions);
    if (sprintId === null) return;
    // Sequential on purpose: an operation's queries share one transaction connection, which runs one query at a time.
    const sprint = await this.sprintsService.getPlannable(access.workspaceId, sprintId);
    const list = await this.listsService.getInWorkspace(access.workspaceId, task.listId);
    TaskPlanningPolicy.assertSameSpace(list.spaceId, sprint.spaceId);
  }

  private async assertAssignable(access: WorkspaceAccess, userId: string): Promise<void> {
    TaskAssignmentPolicy.assertCanChangeAssignee(access.permissions);
    TaskAssignmentPolicy.assertAssigneeIsMember(await this.membersService.isMember(access.workspaceId, userId));
  }
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}
