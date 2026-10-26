import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, TaskStatusResponse } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { DomainEvent } from '../../../core/events/domain-event.js';
import { InProcessEventBus } from '../../../core/events/in-process-event-bus.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import type { CustomFieldsService } from '../../custom-fields/application/custom-fields.service.js';
import type { ListsService } from '../../lists/application/lists.service.js';
import type { MembersService } from '../../members/application/members.service.js';
import type { SpacesService } from '../../spaces/application/spaces.service.js';
import type { SprintsService } from '../../sprints/application/sprints.service.js';
import type { StatusesService } from '../../statuses/application/statuses.service.js';
import {
  InMemoryTaskActivityRepository,
  InMemoryTaskRelationRepository,
  InMemoryTaskRepository,
  InMemoryTaskWatcherRepository,
} from '../testing/in-memory-task.repository.js';
import { TasksService } from './tasks.service.js';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const LIST = '33333333-3333-4333-8333-333333333333';
const OTHER_LIST = '44444444-4444-4444-8444-444444444444';
const SPACE = 'space-a';
const actor: Actor = { userId: 'user-1', platformRole: 'USER', ip: null };

const status = (id: string, name: string, category: TaskStatusResponse['category'], spaceId = SPACE): TaskStatusResponse => ({ id, spaceId, name, color: '#000000', category, position: 0 });
const STATUSES = [status('s-todo', 'To do', 'unstarted'), status('s-doing', 'In progress', 'started'), status('s-done', 'Done', 'done'), status('s-other', 'Elsewhere', 'started', 'space-b')];

function accessWith(...permissions: Permission[]): WorkspaceAccess {
  return { workspaceId: WORKSPACE, roleId: 'role', permissions: new Set(permissions), readableFields: new Set(), viaPlatformRole: false };
}

describe('TasksService', () => {
  let repository: InMemoryTaskRepository;
  let activity: InMemoryTaskActivityRepository;
  let watchers: InMemoryTaskWatcherRepository;
  let members: Set<string>;
  let service: TasksService;
  let events: DomainEvent[];

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
    activity = new InMemoryTaskActivityRepository();
    watchers = new InMemoryTaskWatcherRepository();
    members = new Set(['user-1', 'user-2']);
    const lists = {
      getInWorkspace: async (_workspaceId: string, listId: string) => ({ id: listId, spaceId: SPACE }),
      listForWorkspace: async () => [
        { id: LIST, spaceId: SPACE },
        { id: OTHER_LIST, spaceId: SPACE },
      ],
    } as unknown as ListsService;
    const membersService = {
      isMember: async (_workspaceId: string, userId: string) => members.has(userId),
      list: async () => [...members].map((userId) => ({ userId, name: userId === 'user-1' ? 'Ada' : 'Grace' })),
    } as unknown as MembersService;
    const spaces = { getInWorkspace: async () => ({ id: SPACE }) } as unknown as SpacesService;
    const sprints = {
      getPlannable: async (_workspaceId: string, sprintId: string) => ({ id: sprintId, spaceId: sprintId === 'other-space-sprint' ? 'space-b' : SPACE }),
    } as unknown as SprintsService;
    const statuses = {
      byId: async () => new Map(STATUSES.map((item) => [item.id, item])),
      defaultFor: async () => STATUSES[0],
      getInWorkspace: async (_workspaceId: string, id: string) => {
        const found = STATUSES.find((item) => item.id === id);
        if (!found) throw DomainError.notFound('Status');
        return found;
      },
    } as unknown as StatusesService;
    const customFields = { normalizePatch: async (_w: string, _e: string, _s: string, patch: object) => patch } as unknown as CustomFieldsService;
    events = [];
    const eventBus = new InProcessEventBus();
    eventBus.subscribe(async (event) => {
      events.push(event);
    });
    service = new TasksService(repository, watchers, new InMemoryTaskRelationRepository(), activity, lists, membersService, spaces, sprints, statuses, customFields, eventBus);
  });

  it('numbers tasks, appends them after the last position and starts them in the first not-started status', async () => {
    const first = await service.create(actor, accessWith('task.create'), LIST, { title: '  First  ' });
    const second = await service.create(actor, accessWith('task.create'), LIST, { title: 'Second' });

    expect(first).toMatchObject({ number: 1, title: 'First', statusId: 's-todo', status: { name: 'To do' }, priority: 'none', position: 1024, type: 'task' });
    expect(second).toMatchObject({ number: 2, position: 2048 });
    expect(await watchers.list(WORKSPACE, first.id)).toEqual(['user-1']);
  });

  it('needs task.assign to set an assignee and only assigns members', async () => {
    await expect(service.create(actor, accessWith('task.create'), LIST, { title: 'x', assigneeId: 'user-2' })).rejects.toThrow(/task.assign/);
    await expect(service.create(actor, accessWith('task.create', 'task.assign'), LIST, { title: 'x', assigneeId: 'stranger' })).rejects.toThrow(/member/);
  });

  it("only accepts statuses from the task's own space and tracks completion", async () => {
    const task = await service.create(actor, accessWith('task.create'), LIST, { title: 'Ship' });
    await expect(service.update(actor, accessWith('task.update'), task.id, { statusId: 's-other' })).rejects.toThrow(/another space/);
    const done = await service.update(actor, accessWith('task.update'), task.id, { statusId: 's-done' });
    expect(done.completedAt).not.toBeNull();
    const reopened = await service.update(actor, accessWith('task.update'), task.id, { statusId: 's-doing' });
    expect(reopened.completedAt).toBeNull();
  });

  it('records readable activity and publishes the changes', async () => {
    const task = await service.create(actor, accessWith('task.create', 'task.assign'), LIST, { title: 'Hand over', assigneeId: 'user-1' });
    await service.update(actor, accessWith('task.update', 'task.assign'), task.id, { assigneeId: 'user-2', statusId: 's-doing', priority: 'high' });

    const entries = await service.listActivity(WORKSPACE, task.id);
    expect(entries.map((entry) => [entry.field, entry.from, entry.to])).toEqual(
      expect.arrayContaining([
        ['status', 'To do', 'In progress'],
        ['priority', 'none', 'high'],
        ['assignee', 'Ada', 'Grace'],
      ]),
    );
    expect(events[1]).toMatchObject({ type: 'task.updated', facts: { assigneeId: 'user-2', previousAssigneeId: 'user-1', statusCategory: 'started' } });
    expect(await watchers.list(WORKSPACE, task.id)).toEqual(['user-1', 'user-2']);
  });

  it('keeps subtasks in their parent list and limits nesting', async () => {
    const parent = await service.create(actor, accessWith('task.create'), LIST, { title: 'Parent' });
    await expect(service.create(actor, accessWith('task.create'), OTHER_LIST, { title: 'Wrong list', parentId: parent.id })).rejects.toThrow(/same list/);
    let current = parent;
    for (let level = 1; level <= 3; level += 1) current = await service.create(actor, accessWith('task.create'), LIST, { title: `Level ${level}`, parentId: current.id });
    await expect(service.create(actor, accessWith('task.create'), LIST, { title: 'Too deep', parentId: current.id })).rejects.toThrow(/at most 3/);
    expect((await service.get(WORKSPACE, parent.id)).subtaskCount).toBe(1);
  });

  it('rejects a start date after the due date', async () => {
    await expect(
      service.create(actor, accessWith('task.create'), LIST, { title: 'Backwards', startDate: '2026-05-10T00:00:00Z', dueDate: '2026-05-01T00:00:00Z' }),
    ).rejects.toThrow(/start date/);
  });

  it('relates tasks once, never to themselves', async () => {
    const a = await service.create(actor, accessWith('task.create'), LIST, { title: 'A' });
    const b = await service.create(actor, accessWith('task.create'), LIST, { title: 'B' });
    await expect(service.addRelation(actor, WORKSPACE, a.id, a.id, 'blocks')).rejects.toThrow(/itself/);
    const relations = await service.addRelation(actor, WORKSPACE, a.id, b.id, 'blocks');
    expect(relations).toMatchObject([{ kind: 'blocks', outgoing: true, task: { number: 2 } }]);
    expect(await service.listRelations(WORKSPACE, b.id)).toMatchObject([{ kind: 'blocks', outgoing: false, task: { number: 1 } }]);
    await expect(service.addRelation(actor, WORKSPACE, a.id, b.id, 'blocks')).rejects.toThrow(/already related/);
  });

  it('does not find a task through another workspace', async () => {
    const task = await service.create(actor, accessWith('task.create'), LIST, { title: 'Private' });
    await expect(service.get(OTHER_WORKSPACE, task.id)).rejects.toBeInstanceOf(DomainError);
  });

  it('plans a task into a sprint only with sprint.manage and the same space', async () => {
    const task = await service.create(actor, accessWith('task.create'), LIST, { title: 'Plan me' });
    await expect(service.update(actor, accessWith('task.update'), task.id, { sprintId: 'sprint-1' })).rejects.toThrow(/sprint.manage/);
    await expect(service.update(actor, accessWith('task.update', 'sprint.manage'), task.id, { sprintId: 'other-space-sprint' })).rejects.toThrow(/own space/);
    const planned = await service.update(actor, accessWith('task.update', 'sprint.manage'), task.id, { sprintId: 'sprint-1' });
    expect(planned.sprintId).toBe('sprint-1');
  });
});
