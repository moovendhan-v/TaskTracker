import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import type { ListsService } from '../../lists/application/lists.service.js';
import type { MembersService } from '../../members/application/members.service.js';
import { InMemoryTaskRepository } from '../testing/in-memory-task.repository.js';
import { TasksService } from './tasks.service.js';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const LIST = '33333333-3333-4333-8333-333333333333';
const actor: Actor = { userId: 'user-1', platformRole: 'USER', ip: null };

function accessWith(...permissions: Permission[]): WorkspaceAccess {
  return { workspaceId: WORKSPACE, roleId: 'role', permissions: new Set(permissions), viaPlatformRole: false };
}

describe('TasksService', () => {
  let repository: InMemoryTaskRepository;
  let members: Set<string>;
  let service: TasksService;

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
    members = new Set(['user-1', 'user-2']);
    const lists = { getInWorkspace: async () => ({ id: LIST }) } as unknown as ListsService;
    const membersService = {
      isMember: async (_workspaceId: string, userId: string) => members.has(userId),
    } as unknown as MembersService;
    service = new TasksService(repository, lists, membersService);
  });

  it('appends new tasks after the last position with sensible defaults', async () => {
    const first = await service.create(actor, accessWith('task.create'), LIST, { title: '  First  ' });
    const second = await service.create(actor, accessWith('task.create'), LIST, { title: 'Second' });

    expect(first).toMatchObject({ title: 'First', status: 'todo', priority: 'none', position: 1024 });
    expect(second.position).toBe(2048);
  });

  it('needs task.assign to set an assignee', async () => {
    await expect(
      service.create(actor, accessWith('task.create'), LIST, { title: 'x', assigneeId: 'user-2' }),
    ).rejects.toThrow(/task.assign/);
  });

  it('rejects assignees who are not workspace members', async () => {
    await expect(
      service.create(actor, accessWith('task.create', 'task.assign'), LIST, { title: 'x', assigneeId: 'stranger' }),
    ).rejects.toThrow(/member/);
  });

  it('does not find a task through another workspace', async () => {
    const task = await service.create(actor, accessWith('task.create'), LIST, { title: 'Private' });
    await expect(service.get(OTHER_WORKSPACE, task.id)).rejects.toBeInstanceOf(DomainError);
  });

  it('filters and pages tasks in a list', async () => {
    for (const title of ['Alpha', 'Beta', 'Alphabet']) {
      await service.create(actor, accessWith('task.create'), LIST, { title });
    }
    const page = await service.listInList(WORKSPACE, LIST, { search: 'alpha', pageSize: 1 });
    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(page.items[0]?.title).toBe('Alpha');
  });
});
