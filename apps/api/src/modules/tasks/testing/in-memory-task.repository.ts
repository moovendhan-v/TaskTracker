import { randomUUID } from 'node:crypto';
import { evaluateQuery } from '../../../core/query/evaluate-query.js';
import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { NewTaskActivity, TaskActivity, TaskRelation } from '../domain/task-extras.js';
import { TaskActivityRepository, TaskRelationRepository, TaskWatcherRepository } from '../domain/task-extras.repository.js';
import type { NewTask, Task } from '../domain/task.js';
import { TaskRepository, type TaskPage, type TaskSearchScope } from '../domain/task.repository.js';

/** Test double that honours the same contract as TypeOrmTaskRepository (Liskov). */
export class InMemoryTaskRepository extends TaskRepository {
  readonly rows = new Map<string, Task>();
  private numbers = new Map<string, number>();
  /** Status ids the backlog treats as closed. */
  closedStatusIds = new Set<string>();

  async findInWorkspace(workspaceId: string, taskId: string): Promise<Task | null> {
    const task = this.rows.get(taskId);
    return task && task.workspaceId === workspaceId ? { ...task } : null;
  }

  async findByNumber(workspaceId: string, number: number): Promise<Task | null> {
    return [...this.rows.values()].find((task) => task.workspaceId === workspaceId && task.number === number) ?? null;
  }

  async findMany(workspaceId: string, taskIds: readonly string[]): Promise<Task[]> {
    return taskIds.flatMap((id) => {
      const task = this.rows.get(id);
      return task && task.workspaceId === workspaceId ? [task] : [];
    });
  }

  async search(workspaceId: string, scope: TaskSearchScope, query: NormalizedQuery): Promise<TaskPage> {
    const inScope = [...this.rows.values()].filter((t) => t.workspaceId === workspaceId && (!scope.listId || t.listId === scope.listId));
    return evaluateQuery(inScope, query);
  }

  async maxPosition(workspaceId: string, listId: string): Promise<number> {
    const positions = [...this.rows.values()].filter((t) => t.workspaceId === workspaceId && t.listId === listId).map((t) => t.position);
    return positions.length > 0 ? Math.max(...positions) : 0;
  }

  async listInSprint(workspaceId: string, sprintId: string, limit: number): Promise<Task[]> {
    return [...this.rows.values()].filter((t) => t.workspaceId === workspaceId && t.sprintId === sprintId).slice(0, limit);
  }

  async backlogInSpace(workspaceId: string, _spaceId: string, limit: number): Promise<Task[]> {
    return [...this.rows.values()].filter((t) => t.workspaceId === workspaceId && t.sprintId === null && !this.closedStatusIds.has(t.statusId)).slice(0, limit);
  }

  async nextNumber(workspaceId: string): Promise<number> {
    const next = (this.numbers.get(workspaceId) ?? 0) + 1;
    this.numbers.set(workspaceId, next);
    return next;
  }

  async countSubtasks(workspaceId: string, taskIds: readonly string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const task of this.rows.values()) {
      if (task.workspaceId === workspaceId && task.parentId && taskIds.includes(task.parentId)) counts.set(task.parentId, (counts.get(task.parentId) ?? 0) + 1);
    }
    return counts;
  }

  async listSubtasks(workspaceId: string, parentId: string, limit: number): Promise<Task[]> {
    return [...this.rows.values()].filter((t) => t.workspaceId === workspaceId && t.parentId === parentId).slice(0, limit);
  }

  async depthOf(workspaceId: string, taskId: string): Promise<number> {
    let depth = 0;
    let current = this.rows.get(taskId);
    while (current?.parentId && current.workspaceId === workspaceId && depth < 10) {
      depth += 1;
      current = this.rows.get(current.parentId);
    }
    return depth;
  }

  async create(task: NewTask): Promise<Task> {
    const now = new Date();
    const created: Task = { ...task, id: randomUUID(), createdAt: now, updatedAt: now };
    this.rows.set(created.id, created);
    return { ...created };
  }

  async save(task: Task): Promise<Task> {
    const saved = { ...task, updatedAt: new Date() };
    this.rows.set(task.id, saved);
    return { ...saved };
  }

  async delete(workspaceId: string, taskId: string): Promise<void> {
    const task = this.rows.get(taskId);
    if (task?.workspaceId === workspaceId) this.rows.delete(taskId);
  }
}

export class InMemoryTaskWatcherRepository extends TaskWatcherRepository {
  readonly rows = new Map<string, Set<string>>();

  async list(_workspaceId: string, taskId: string): Promise<string[]> {
    return [...(this.rows.get(taskId) ?? [])];
  }

  async add(_workspaceId: string, taskId: string, userIds: readonly string[]): Promise<void> {
    const set = this.rows.get(taskId) ?? new Set<string>();
    for (const id of userIds) set.add(id);
    this.rows.set(taskId, set);
  }

  async remove(_workspaceId: string, taskId: string, userId: string): Promise<void> {
    this.rows.get(taskId)?.delete(userId);
  }
}

export class InMemoryTaskRelationRepository extends TaskRelationRepository {
  readonly rows: TaskRelation[] = [];

  async listFor(workspaceId: string, taskId: string): Promise<TaskRelation[]> {
    return this.rows.filter((r) => r.workspaceId === workspaceId && (r.taskId === taskId || r.relatedTaskId === taskId));
  }

  async findInWorkspace(workspaceId: string, relationId: string): Promise<TaskRelation | null> {
    return this.rows.find((r) => r.id === relationId && r.workspaceId === workspaceId) ?? null;
  }

  async create(relation: Omit<TaskRelation, 'id' | 'createdAt'>): Promise<TaskRelation | null> {
    if (this.rows.some((r) => r.taskId === relation.taskId && r.relatedTaskId === relation.relatedTaskId && r.kind === relation.kind)) return null;
    const created = { ...relation, id: randomUUID(), createdAt: new Date() };
    this.rows.push(created);
    return created;
  }

  async delete(workspaceId: string, relationId: string): Promise<void> {
    const index = this.rows.findIndex((r) => r.id === relationId && r.workspaceId === workspaceId);
    if (index >= 0) this.rows.splice(index, 1);
  }
}

export class InMemoryTaskActivityRepository extends TaskActivityRepository {
  readonly rows: TaskActivity[] = [];

  async record(entries: readonly NewTaskActivity[]): Promise<void> {
    for (const entry of entries) this.rows.unshift({ ...entry, id: randomUUID(), actorName: null, createdAt: new Date() });
  }

  async list(workspaceId: string, taskId: string, limit: number): Promise<TaskActivity[]> {
    return this.rows.filter((r) => r.workspaceId === workspaceId && r.taskId === taskId).slice(0, limit);
  }
}
