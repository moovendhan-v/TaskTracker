import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

interface Page {
  total: number;
  page: number;
  pageSize: number;
  items: { id: string; title: string }[];
}

const SEARCH = `query($w: ID!, $l: ID, $s: ID, $q: ResourceQueryInput) {
  searchTasks(workspaceId: $w, listId: $l, spaceId: $s, query: $q) { total page pageSize items { id title status { name } priority metadata } }
}`;

describe('resource queries (filters, sorting, paging, schema)', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let guest: TestUser;
  const search = (query: unknown, user?: TestUser, scope: Record<string, string> = {}) =>
    (user ?? ws.owner).data<{ searchTasks: Page }>(SEARCH, { w: ws.workspaceId, q: query, ...scope }).then((r) => r.searchTasks);
  const titles = (page: Page) => page.items.map((item) => item.title);

  beforeAll(async () => {
    ws = await createWorkspace('Filters owner');
    member = await TestUser.signUp('Filters member');
    guest = await TestUser.signUp('Filters guest');
    await addMember(ws, member, 'Member');
    await addMember(ws, guest, 'Guest');

    const create = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
    const tasks = [
      { title: 'Ship order 6735', priority: 'urgent', statusId: ws.statuses['In progress'], metadata: { order_id: '6735', total: 250 } },
      { title: 'Ship order 9000', priority: 'low', statusId: ws.statuses['To do'], metadata: { order_id: '9000', total: 'n/a' } },
      { title: 'Write release notes', priority: 'high', statusId: ws.statuses['Done'], metadata: {} },
      { title: "Fix 100% CPU; DROP TABLE task;--", priority: 'normal', statusId: ws.statuses['To do'] },
    ];
    for (const input of tasks) await ws.owner.data(create, { w: ws.workspaceId, l: ws.listId, input });
  });

  it('filters by a metadata key with the compact where syntax', async () => {
    expect(titles(await search({ where: 'metadata[order_id]=6735' }))).toEqual(['Ship order 6735']);
    expect(titles(await search({ where: 'metadata[total][gt]=100' }))).toEqual(['Ship order 6735']);
  });

  it('combines AND, OR and NOT, and sorts by priority rank', async () => {
    const page = await search({
      filter: {
        and: [
          { or: [{ field: 'title', op: 'starts_with', value: 'ship' }, { field: 'priority', op: 'eq', value: 'high' }] },
          { not: { field: 'statusCategory', op: 'eq', value: 'unstarted' } },
        ],
      },
      sort: [{ field: 'priority', direction: 'asc' }],
    });
    expect(titles(page)).toEqual(['Ship order 6735', 'Write release notes']);
  });

  it('treats input as data, never SQL', async () => {
    expect(titles(await search({ filter: { field: 'title', op: 'contains', value: '100%' } }))).toEqual(['Fix 100% CPU; DROP TABLE task;--']);
    expect((await search({ filter: { field: 'title', op: 'eq', value: "x' OR '1'='1" } })).total).toBe(0);
    expect((await ws.owner.error(SEARCH, { w: ws.workspaceId, q: { where: "metadata[order_id') OR 1=1 --]=1" } })).code).toBe('BAD_USER_INPUT');
    expect((await search({})).total).toBe(4);
  });

  it('pages with a stable order and reports the totals', async () => {
    const first = await search({ sort: [{ field: 'title', direction: 'asc' }], pageSize: 2 });
    const second = await search({ sort: [{ field: 'title', direction: 'asc' }], pageSize: 2, page: 2 });
    expect(first).toMatchObject({ total: 4, page: 1, pageSize: 2 });
    expect([...titles(first), ...titles(second)]).toEqual(['Fix 100% CPU; DROP TABLE task;--', 'Ship order 6735', 'Ship order 9000', 'Write release notes']);
  });

  it('rejects unknown fields, bad operators, bad values and oversized pages', async () => {
    const errorOf = (query: unknown) => ws.owner.error(SEARCH, { w: ws.workspaceId, q: query });
    expect(await errorOf({ filter: { field: 'secret', op: 'eq', value: '1' } })).toMatchObject({ code: 'BAD_USER_INPUT', message: 'Unknown field secret' });
    expect((await errorOf({ filter: { field: 'statusId', op: 'contains', value: 'to' } })).code).toBe('BAD_USER_INPUT');
    expect((await errorOf({ filter: { field: 'dueDate', op: 'gt', value: 'tomorrow' } })).code).toBe('BAD_USER_INPUT');
    expect((await errorOf({ pageSize: 101 })).code).toBe('BAD_USER_INPUT');
    expect((await errorOf({ sort: [{ field: 'description', direction: 'asc' }] })).code).toBe('BAD_USER_INPUT');
  });

  it('resolves @me to the caller', async () => {
    const assign = 'mutation($w: ID!, $t: ID!, $a: ID) { updateTask(workspaceId: $w, taskId: $t, input: { assigneeId: $a }) { id } }';
    const [target] = (await search({ where: 'metadata[order_id]=9000' })).items;
    await ws.owner.data(assign, { w: ws.workspaceId, t: target!.id, a: member.id });
    expect(titles(await search({ where: 'assigneeId=@me' }, member))).toEqual(['Ship order 9000']);
    expect((await search({ where: 'assigneeId=@me' })).total).toBe(0);
  });

  it('merges metadata on update and removes keys set to null', async () => {
    const [target] = (await search({ where: 'metadata[order_id]=6735' })).items;
    const update = 'mutation($w: ID!, $t: ID!, $m: Metadata) { updateTask(workspaceId: $w, taskId: $t, input: { metadata: $m }) { metadata } }';
    const { updateTask } = await ws.owner.data<{ updateTask: { metadata: Record<string, unknown> } }>(update, { w: ws.workspaceId, t: target!.id, m: { carrier: 'DHL', total: null } });
    expect(updateTask.metadata).toEqual({ order_id: '6735', carrier: 'DHL' });
    expect((await ws.owner.error(update, { w: ws.workspaceId, t: target!.id, m: { 'bad key': 1 } })).code).toBe('BAD_USER_INPUT');
  });

  it('describes resources for building tables, trimmed to what the caller may see', async () => {
    const schemaQuery = `query($w: ID!, $r: String!) { resourceSchema(workspaceId: $w, resource: $r) {
      resource logic searchable defaultPageSize maxPageSize defaultSort { field direction }
      fields { name type operators sortable keyed options { value label } } } }`;
    const { resourceSchema } = await member.data<{ resourceSchema: { fields: { name: string; operators: string[]; options: { value: string; label: string }[] | null }[]; logic: string[]; maxPageSize: number } }>(
      schemaQuery,
      { w: ws.workspaceId, r: 'tasks' },
    );
    expect(resourceSchema.logic).toEqual(['and', 'or', 'not']);
    expect(resourceSchema.maxPageSize).toBe(100);
    const status = resourceSchema.fields.find((field) => field.name === 'statusId');
    expect(status?.operators).toContain('in');
    expect(status?.options?.map((option) => option.label)).toEqual(['To do', 'In progress', 'In review', 'Blocked', 'Done']);

    const { resourceSchema: members } = await member.data<{ resourceSchema: { fields: { name: string; options: { label: string }[] | null }[] } }>(schemaQuery, {
      w: ws.workspaceId,
      r: 'members',
    });
    expect(members.fields.find((field) => field.name === 'roleId')?.options?.map((option) => option.label)).toContain('Guest');

    // Guests can't see the audit log, so it doesn't exist for them.
    expect((await guest.error(schemaQuery, { w: ws.workspaceId, r: 'audit_log' })).code).toBe('NOT_FOUND');
    expect((await member.error(schemaQuery, { w: ws.workspaceId, r: 'nope' })).code).toBe('NOT_FOUND');
    const { resourceNames } = await guest.data<{ resourceNames: string[] }>('query($w: ID!) { resourceNames(workspaceId: $w) }', { w: ws.workspaceId });
    expect(resourceNames).toEqual(['members', 'tasks']);
  });

  it('searches members and the audit log the same way', async () => {
    const { searchMembers } = await member.data<{ searchMembers: { total: number; items: { name: string }[] } }>(
      'query($w: ID!, $q: ResourceQueryInput) { searchMembers(workspaceId: $w, query: $q) { total items { name } } }',
      { w: ws.workspaceId, q: { search: 'guest', sort: [{ field: 'joinedAt', direction: 'desc' }] } },
    );
    expect(searchMembers.items.map((item) => item.name)).toEqual(['Filters guest']);

    const { searchWorkspaceAuditLog } = await ws.owner.data<{ searchWorkspaceAuditLog: { items: { action: string }[] } }>(
      'query($w: ID!, $q: ResourceQueryInput) { searchWorkspaceAuditLog(workspaceId: $w, query: $q) { items { action } } }',
      { w: ws.workspaceId, q: { where: 'action[starts_with]=member.' } },
    );
    expect(new Set(searchWorkspaceAuditLog.items.map((item) => item.action))).toEqual(new Set(['member.add']));
    expect((await member.error('query($w: ID!) { searchWorkspaceAuditLog(workspaceId: $w) { total } }', { w: ws.workspaceId })).code).toBe('FORBIDDEN');
  });

  it('keeps tenants apart', async () => {
    const other = await createWorkspace('Other filters owner');
    expect((await other.owner.error(SEARCH, { w: ws.workspaceId, q: {} })).code).toBe('NOT_FOUND');
    expect((await ws.owner.error(SEARCH, { w: ws.workspaceId, l: other.listId, q: {} })).code).toBe('NOT_FOUND');
  });
});
