import { randomUUID } from 'node:crypto';
import type { PageRequest } from '../../../core/http/dto/page-query.dto.js';
import type { NewTask, Task, TaskFilter } from '../domain/task.js';
import { TaskRepository, type TaskPage } from '../domain/task.repository.js';

/** Test double that honours the same contract as TypeOrmTaskRepository (Liskov). */
export class InMemoryTaskRepository extends TaskRepository {
  readonly rows = new Map<string, Task>();

  async findInWorkspace(workspaceId: string, taskId: string): Promise<Task | null> {
    const task = this.rows.get(taskId);
    return task && task.workspaceId === workspaceId ? { ...task } : null;
  }

  async pageInList(workspaceId: string, listId: string, filter: TaskFilter, page: PageRequest): Promise<TaskPage> {
    const search = filter.search?.toLowerCase();
    const matches = [...this.rows.values()]
      .filter((t) => t.workspaceId === workspaceId && t.listId === listId)
      .filter((t) => !filter.status || t.status === filter.status)
      .filter((t) => !search || t.title.toLowerCase().includes(search))
      .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
    const start = (page.page - 1) * page.pageSize;
    return { items: matches.slice(start, start + page.pageSize), total: matches.length };
  }

  async maxPosition(workspaceId: string, listId: string): Promise<number> {
    const positions = [...this.rows.values()]
      .filter((t) => t.workspaceId === workspaceId && t.listId === listId)
      .map((t) => t.position);
    return positions.length > 0 ? Math.max(...positions) : 0;
  }

  async listInSprint(workspaceId: string, sprintId: string, limit: number): Promise<Task[]> {
    return [...this.rows.values()]
      .filter((t) => t.workspaceId === workspaceId && t.sprintId === sprintId)
      .sort((a, b) => a.position - b.position)
      .slice(0, limit);
  }

  /** The fake has no list-to-space mapping, so `spaceId` is matched against listId. */
  async backlogInSpace(workspaceId: string, spaceId: string, limit: number): Promise<Task[]> {
    return [...this.rows.values()]
      .filter((t) => t.workspaceId === workspaceId && t.listId === spaceId && t.sprintId === null && t.status !== 'done')
      .slice(0, limit);
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
    if (this.rows.get(taskId)?.workspaceId === workspaceId) this.rows.delete(taskId);
  }
}
