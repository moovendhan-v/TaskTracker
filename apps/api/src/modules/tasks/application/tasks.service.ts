import { Injectable } from '@nestjs/common';
import type {
  CreateTaskRequest,
  Paginated,
  TaskQuery,
  TaskResponse,
  UpdateTaskRequest,
} from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import { toPageRequest } from '../../../core/domain/page-request.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ListsService } from '../../lists/application/lists.service.js';
import { MembersService } from '../../members/application/members.service.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { SprintsService } from '../../sprints/application/sprints.service.js';
import { TASK_POSITION_STEP, type Task } from '../domain/task.js';
import { TaskAssignmentPolicy } from '../domain/task-assignment.policy.js';
import { TaskPlanningPolicy } from '../domain/task-planning.policy.js';
import { TaskRepository } from '../domain/task.repository.js';
import { TaskMapper } from './task.mapper.js';

/** Sprint and backlog views show at most this many tasks. */
const PLANNING_VIEW_LIMIT = 200;

@Injectable()
export class TasksService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly listsService: ListsService,
    private readonly membersService: MembersService,
    private readonly spacesService: SpacesService,
    private readonly sprintsService: SprintsService,
    private readonly eventBus: EventBus,
  ) {}

  async listInList(workspaceId: string, listId: string, query: TaskQuery): Promise<Paginated<TaskResponse>> {
    await this.listsService.getInWorkspace(workspaceId, listId);
    const page = toPageRequest(query);
    const result = await this.tasks.pageInList(workspaceId, listId, { status: query.status, search: query.search }, page);
    return { items: result.items.map(TaskMapper.toResponse), total: result.total, ...page };
  }

  async listInSprint(workspaceId: string, sprintId: string): Promise<TaskResponse[]> {
    await this.sprintsService.getInWorkspace(workspaceId, sprintId);
    const tasks = await this.tasks.listInSprint(workspaceId, sprintId, PLANNING_VIEW_LIMIT);
    return tasks.map(TaskMapper.toResponse);
  }

  async backlog(workspaceId: string, spaceId: string): Promise<TaskResponse[]> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    const tasks = await this.tasks.backlogInSpace(workspaceId, spaceId, PLANNING_VIEW_LIMIT);
    return tasks.map(TaskMapper.toResponse);
  }

  async get(workspaceId: string, taskId: string): Promise<TaskResponse> {
    return TaskMapper.toResponse(await this.getInWorkspace(workspaceId, taskId));
  }

  async create(actor: Actor, access: WorkspaceAccess, listId: string, request: CreateTaskRequest): Promise<TaskResponse> {
    const { workspaceId } = access;
    await this.listsService.getInWorkspace(workspaceId, listId);
    if (request.assigneeId) await this.assertAssignable(access, request.assigneeId);

    const task = await this.tasks.create({
      workspaceId,
      listId,
      title: request.title.trim(),
      description: request.description ?? '',
      status: request.status ?? 'todo',
      priority: request.priority ?? 'none',
      dueDate: request.dueDate ? new Date(request.dueDate) : null,
      assigneeId: request.assigneeId ?? null,
      sprintId: null,
      position: (await this.tasks.maxPosition(workspaceId, listId)) + TASK_POSITION_STEP,
      createdById: actor.userId,
    });
    await this.publish('created', actor, task);
    return TaskMapper.toResponse(task);
  }

  async update(actor: Actor, access: WorkspaceAccess, taskId: string, request: UpdateTaskRequest): Promise<TaskResponse> {
    const task = await this.getInWorkspace(access.workspaceId, taskId);
    const previousAssigneeId = task.assigneeId;

    if (request.assigneeId !== undefined && request.assigneeId !== task.assigneeId) {
      if (request.assigneeId === null) TaskAssignmentPolicy.assertCanChangeAssignee(access.permissions);
      else await this.assertAssignable(access, request.assigneeId);
      task.assigneeId = request.assigneeId;
    }
    if (request.sprintId !== undefined && request.sprintId !== task.sprintId) {
      await this.assertPlannable(access, task, request.sprintId);
      task.sprintId = request.sprintId;
    }
    if (request.title !== undefined) task.title = request.title.trim();
    if (request.description !== undefined) task.description = request.description;
    if (request.status !== undefined) task.status = request.status;
    if (request.priority !== undefined) task.priority = request.priority;
    if (request.dueDate !== undefined) task.dueDate = request.dueDate ? new Date(request.dueDate) : null;
    if (request.position !== undefined) task.position = request.position;

    const saved = await this.tasks.save(task);
    await this.publish('updated', actor, saved, previousAssigneeId);
    return TaskMapper.toResponse(saved);
  }

  async remove(actor: Actor, workspaceId: string, taskId: string): Promise<void> {
    const task = await this.getInWorkspace(workspaceId, taskId);
    await this.tasks.delete(workspaceId, taskId);
    await this.publish('deleted', actor, task);
  }

  /** Who cares about a task: for notifying people about comments on it. */
  async participants(workspaceId: string, taskId: string): Promise<{ title: string; assigneeId: string | null; createdById: string }> {
    const { title, assigneeId, createdById } = await this.getInWorkspace(workspaceId, taskId);
    return { title, assigneeId, createdById };
  }

  private publish(change: 'created' | 'updated' | 'deleted', actor: Actor, task: Task, previousAssigneeId?: string | null): Promise<void> {
    return this.eventBus.publish(
      domainEvent('task', change, {
        workspaceId: task.workspaceId,
        entityId: task.id,
        actorId: actor.userId,
        facts: { title: task.title, assigneeId: task.assigneeId, previousAssigneeId, createdById: task.createdById },
      }),
    );
  }

  private async getInWorkspace(workspaceId: string, taskId: string): Promise<Task> {
    const task = await this.tasks.findInWorkspace(workspaceId, taskId);
    if (!task) throw DomainError.notFound('Task');
    return task;
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
