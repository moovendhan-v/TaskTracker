import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const TASK = 'id number title type parentId statusId status { name category } completedAt subtaskCount startDate dueDate estimateMinutes progress customFields';

interface Task {
  id: string;
  number: number;
  title: string;
  status: { name: string; category: string };
  completedAt: string | null;
  subtaskCount: number;
  customFields: Record<string, unknown>;
}

describe('task model: statuses, numbers, subtasks, relations, custom fields, activity', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const create = (input: Record<string, unknown>, user?: TestUser) =>
    (user ?? ws.owner)
      .data<{ createTask: Task }>(`mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { ${TASK} } }`, vars({ l: ws.listId, input }))
      .then((r) => r.createTask);
  const update = (taskId: string, input: Record<string, unknown>, user?: TestUser) =>
    (user ?? ws.owner)
      .data<{ updateTask: Task }>(`mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { ${TASK} } }`, vars({ t: taskId, input }))
      .then((r) => r.updateTask);

  beforeAll(async () => {
    ws = await createWorkspace('Model owner');
    member = await TestUser.signUp('Model member');
    await addMember(ws, member, 'Member');
  });

  it('gives each space default statuses and lets managers customise them', async () => {
    expect(Object.keys(ws.statuses)).toEqual(['To do', 'In progress', 'In review', 'Blocked', 'Done']);
    const createStatus = 'mutation($w: ID!, $s: ID!, $input: CreateTaskStatusInput!) { createStatus(workspaceId: $w, spaceId: $s, input: $input) { id name category position } }';
    const { createStatus: qa } = await ws.owner.data<{ createStatus: { id: string; position: number } }>(createStatus, vars({ s: ws.spaceId, input: { name: 'QA', color: '#f59e0b', category: 'review' } }));
    expect(qa.position).toBe(6);
    expect((await member.error(createStatus, vars({ s: ws.spaceId, input: { name: 'Nope', color: '#000000', category: 'started' } }))).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(createStatus, vars({ s: ws.spaceId, input: { name: 'qa', color: '#000000', category: 'started' } }))).code).toBe('CONFLICT');

    const ids = [qa.id, ...Object.values(ws.statuses)];
    const { reorderStatuses } = await ws.owner.data<{ reorderStatuses: { name: string }[] }>(
      'mutation($w: ID!, $s: ID!, $ids: [ID!]!) { reorderStatuses(workspaceId: $w, spaceId: $s, statusIds: $ids) { name } }',
      vars({ s: ws.spaceId, ids }),
    );
    expect(reorderStatuses.map((s) => s.name)).toEqual(['QA', 'To do', 'In progress', 'In review', 'Blocked', 'Done']);

    // Deleting a status moves its tasks first.
    const task = await create({ title: 'In QA', statusId: qa.id });
    await ws.owner.data('mutation($w: ID!, $s: ID!, $to: ID!) { deleteStatus(workspaceId: $w, statusId: $s, moveTasksTo: $to) }', vars({ s: qa.id, to: ws.statuses['In review'] }));
    const { task: moved } = await ws.owner.data<{ task: Task }>(`query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { ${TASK} } }`, vars({ t: task.id }));
    expect(moved.status.name).toBe('In review');
  });

  it('numbers tasks per workspace and finds them by number', async () => {
    const a = await create({ title: 'Numbered A' });
    const b = await create({ title: 'Numbered B', type: 'bug' });
    expect(b.number).toBe(a.number + 1);
    const { taskByNumber } = await member.data<{ taskByNumber: { title: string } }>('query($w: ID!, $n: Int!) { taskByNumber(workspaceId: $w, number: $n) { title } }', vars({ n: b.number }));
    expect(taskByNumber.title).toBe('Numbered B');
    const search = await ws.owner.data<{ searchTasks: { items: { title: string }[] } }>(
      'query($w: ID!, $q: ResourceQueryInput) { searchTasks(workspaceId: $w, query: $q) { items { title } } }',
      vars({ q: { search: `#${b.number}` } }),
    );
    expect(search.searchTasks.items.map((t) => t.title)).toContain('Numbered B');
  });

  it('records completion when a task enters a done status, and clears it on reopen', async () => {
    const task = await create({ title: 'Finish me' });
    expect((await update(task.id, { statusId: ws.statuses['Done'] })).completedAt).not.toBeNull();
    expect((await update(task.id, { statusId: ws.statuses['To do'] })).completedAt).toBeNull();
    const other = await createWorkspace('Other statuses');
    expect((await ws.owner.error(
      'mutation($w: ID!, $t: ID!, $s: ID!) { updateTask(workspaceId: $w, taskId: $t, input: { statusId: $s }) { id } }',
      vars({ t: task.id, s: other.statuses['Done'] }),
    )).code).toBe('NOT_FOUND');
  });

  it('nests subtasks and lists them', async () => {
    const parent = await create({ title: 'Epic' });
    await create({ title: 'Child 1', parentId: parent.id });
    await create({ title: 'Child 2', parentId: parent.id });
    const { subtasks } = await member.data<{ subtasks: { title: string }[] }>('query($w: ID!, $t: ID!) { subtasks(workspaceId: $w, taskId: $t) { title } }', vars({ t: parent.id }));
    expect(subtasks.map((t) => t.title)).toEqual(['Child 1', 'Child 2']);
    const { task } = await member.data<{ task: Task }>(`query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { ${TASK} } }`, vars({ t: parent.id }));
    expect(task.subtaskCount).toBe(2);
    const topLevel = await member.data<{ searchTasks: { items: { title: string }[] } }>(
      'query($w: ID!, $q: ResourceQueryInput) { searchTasks(workspaceId: $w, query: $q) { items { title } } }',
      vars({ q: { where: 'parentId[is_null]=&title[starts_with]=Child' } }),
    );
    expect(topLevel.searchTasks.items).toEqual([]);
  });

  it('relates tasks both ways and keeps an activity history', async () => {
    const a = await create({ title: 'Blocker' });
    const b = await create({ title: 'Blocked work' });
    await ws.owner.data('mutation($w: ID!, $a: ID!, $b: ID!) { relateTasks(workspaceId: $w, taskId: $a, relatedTaskId: $b, kind: blocks) { id } }', vars({ a: a.id, b: b.id }));
    const { taskRelations } = await member.data<{ taskRelations: { kind: string; outgoing: boolean; task: { title: string } }[] }>(
      'query($w: ID!, $t: ID!) { taskRelations(workspaceId: $w, taskId: $t) { kind outgoing task { title } } }',
      vars({ t: b.id }),
    );
    expect(taskRelations).toEqual([{ kind: 'blocks', outgoing: false, task: { title: 'Blocker' } }]);

    await update(a.id, { statusId: ws.statuses['In progress'], priority: 'urgent' });
    const { taskActivity } = await member.data<{ taskActivity: { kind: string; field: string | null; from: string | null; to: string | null }[] }>(
      'query($w: ID!, $t: ID!) { taskActivity(workspaceId: $w, taskId: $t) { kind field from to } }',
      vars({ t: a.id }),
    );
    expect(taskActivity).toEqual(
      expect.arrayContaining([
        { kind: 'changed', field: 'status', from: 'To do', to: 'In progress' },
        { kind: 'related', field: 'blocks', from: null, to: `#${b.number}` },
        { kind: 'created', field: null, from: null, to: null },
      ]),
    );
  });

  it('lets people watch tasks and notifies watchers about comments', async () => {
    const task = await create({ title: 'Watch me' });
    const { watchTask } = await member.data<{ watchTask: string[] }>('mutation($w: ID!, $t: ID!) { watchTask(workspaceId: $w, taskId: $t, watching: true) }', vars({ t: task.id }));
    expect(watchTask).toContain(member.id);
    await ws.owner.data('mutation($w: ID!, $t: ID!) { createComment(workspaceId: $w, taskId: $t, input: { body: "Heads up" }) { id } }', vars({ t: task.id }));
    const { notifications } = await member.data<{ notifications: { items: { kind: string; subject: string }[] } }>(
      'query($w: ID!) { notifications(workspaceId: $w) { items { kind subject } } }',
      vars(),
    );
    expect(notifications.items).toContainEqual({ kind: 'task_commented', subject: 'Watch me' });
  });

  it('validates custom field values by type and filters by them', async () => {
    const createField = 'mutation($w: ID!, $input: CreateCustomFieldInput!) { createCustomField(workspaceId: $w, input: $input) { id options { id label } } }';
    const { createCustomField: tier } = await ws.owner.data<{ createCustomField: { id: string; options: { id: string; label: string }[] } }>(createField, vars({
      input: { name: 'Tier', type: 'select', options: [{ label: 'Gold' }, { label: 'Silver' }] },
    }));
    const { createCustomField: points } = await ws.owner.data<{ createCustomField: { id: string } }>(createField, vars({ input: { name: 'Points', type: 'number' } }));
    const gold = tier.options.find((option) => option.label === 'Gold')!.id;

    const task = await create({ title: 'Custom', customFields: { [tier.id]: gold, [points.id]: 5 } });
    expect(task.customFields).toEqual({ [tier.id]: gold, [points.id]: 5 });
    expect((await ws.owner.error(
      'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }',
      vars({ l: ws.listId, input: { title: 'Bad', customFields: { [points.id]: 'five' } } }),
    )).message).toBe('Points: use a number');

    const byTier = await ws.owner.data<{ searchTasks: { items: { title: string }[] } }>(
      'query($w: ID!, $q: ResourceQueryInput) { searchTasks(workspaceId: $w, query: $q) { items { title } } }',
      vars({ q: { where: `custom[${points.id}][gte]=5` } }),
    );
    expect(byTier.searchTasks.items.map((t) => t.title)).toEqual(['Custom']);

    const { resourceSchema } = await member.data<{ resourceSchema: { fields: { name: string; label: string }[] } }>(
      'query($w: ID!) { resourceSchema(workspaceId: $w, resource: "tasks") { fields { name label } } }',
      vars(),
    );
    expect(resourceSchema.fields).toContainEqual({ name: `custom.${tier.id}`, label: 'Tier' });

    await ws.owner.data('mutation($w: ID!, $f: ID!) { deleteCustomField(workspaceId: $w, fieldId: $f) }', vars({ f: points.id }));
    const { task: after } = await ws.owner.data<{ task: Task }>(`query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { ${TASK} } }`, vars({ t: task.id }));
    expect(after.customFields).toEqual({ [tier.id]: gold });
  });

  it('tracks project status and dates on spaces', async () => {
    const { updateSpace } = await ws.owner.data<{ updateSpace: { status: string; statusNote: string; startDate: string } }>(
      'mutation($w: ID!, $s: ID!) { updateSpace(workspaceId: $w, spaceId: $s, input: { status: at_risk, statusNote: "Vendor late", startDate: "2026-01-05", dueDate: "2026-03-31" }) { status statusNote startDate } }',
      vars({ s: ws.spaceId }),
    );
    expect(updateSpace).toEqual({ status: 'at_risk', statusNote: 'Vendor late', startDate: '2026-01-05' });
    expect((await ws.owner.error(
      'mutation($w: ID!, $s: ID!) { updateSpace(workspaceId: $w, spaceId: $s, input: { startDate: "2026-05-01", dueDate: "2026-04-01" }) { status } }',
      vars({ s: ws.spaceId }),
    )).code).toBe('BAD_USER_INPUT');
  });
});
