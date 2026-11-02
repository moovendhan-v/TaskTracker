import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';


/** Leave dates always in the future: November of next year, counted from its first Monday (day(5) is a Saturday). */
const LEAVE_YEAR = new Date().getUTCFullYear() + 1;
const firstMonday = (() => {
  const date = new Date(Date.UTC(LEAVE_YEAR, 10, 1));
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  return date;
})();
const day = (offset: number) => new Date(firstMonday.getTime() + offset * 86_400_000).toISOString().slice(0, 10);

describe('documents', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  const ids: Record<string, string> = {};
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const create = 'mutation($w: ID!, $input: CreateDocumentInput!) { createDocument(workspaceId: $w, input: $input) { id title content } }';

  beforeAll(async () => {
    ws = await createWorkspace('Doc owner');
    member = await TestUser.signUp('Doc member');
    await addMember(ws, member, 'Member');
  });

  it('blocks script links on the server and keeps safe ones', async () => {
    const { createDocument } = await ws.owner.data<{ createDocument: { id: string; content: string } }>(
      create,
      vars({ input: { title: 'Handbook', content: '# Welcome\n[bad](javascript:alert(1)) and [ok](https://example.com)' } }),
    );
    expect(createDocument.content).not.toMatch(/javascript:/i);
    expect(createDocument.content).toContain('#blocked-link:');
    expect(createDocument.content).toContain('https://example.com');
    ids['handbook'] = createDocument.id;
  });

  it('builds a page tree and searches titles', async () => {
    ids['onboarding'] = (await ws.owner.data<{ createDocument: { id: string } }>(create, vars({ input: { title: 'Onboarding', parentId: ids['handbook'] } }))).createDocument.id;
    ids['week'] = (await ws.owner.data<{ createDocument: { id: string } }>(create, vars({ input: { title: 'First week', parentId: ids['onboarding'] } }))).createDocument.id;
    const tree = await ws.owner.data<{ documents: { id: string }[] }>('query($w: ID!) { documents(workspaceId: $w) { id } }', vars());
    expect(tree.documents).toHaveLength(3);
    const search = await ws.owner.data<{ documents: { title: string }[] }>('query($w: ID!) { documents(workspaceId: $w, search: "week") { title } }', vars());
    expect(search.documents.map((doc) => doc.title)).toEqual(['First week']);
  });

  it('refuses to move a page inside itself, and moves to the top level with a null parent', async () => {
    const move = 'mutation($w: ID!, $d: ID!, $p: ID) { moveDocument(workspaceId: $w, documentId: $d, parentId: $p) { parentId } }';
    expect((await ws.owner.error(move, vars({ d: ids['handbook'], p: ids['week'] }))).message).toMatch(/inside itself/);
    const { moveDocument } = await ws.owner.data<{ moveDocument: { parentId: string | null } }>(move, vars({ d: ids['week'], p: null }));
    expect(moveDocument.parentId).toBeNull();
  });

  it('keeps folders for organising: no content, and only inside other folders', async () => {
    const folderOf = async (title: string, parentId?: string) =>
      (await ws.owner.data<{ createDocument: { id: string } }>(create, vars({ input: { title, kind: 'folder', parentId } }))).createDocument.id;
    ids['specs'] = await folderOf('Specs');
    ids['api'] = await folderOf('API', ids['specs']);
    const move = 'mutation($w: ID!, $d: ID!, $p: ID) { moveDocument(workspaceId: $w, documentId: $d, parentId: $p) { parentId kind } }';
    // A page goes into a folder; a folder doesn't go into a page.
    expect((await ws.owner.data<{ moveDocument: { parentId: string } }>(move, vars({ d: ids['week'], p: ids['api'] }))).moveDocument.parentId).toBe(ids['api']);
    expect((await ws.owner.error(move, vars({ d: ids['specs'], p: ids['onboarding'] }))).message).toMatch(/only go inside another folder/);
    expect((await ws.owner.error(move, vars({ d: ids['specs'], p: ids['api'] }))).message).toMatch(/inside itself/);
    const update = 'mutation($w: ID!, $d: ID!, $input: UpdateDocumentInput!) { updateDocument(workspaceId: $w, documentId: $d, input: $input) { title } }';
    expect((await ws.owner.error(update, vars({ d: ids['specs'], input: { content: 'text' } }))).message).toMatch(/no content/);
    expect((await ws.owner.data<{ updateDocument: { title: string } }>(update, vars({ d: ids['specs'], input: { title: 'Specifications' } }))).updateDocument.title).toBe('Specifications');
    await ws.owner.data(move, vars({ d: ids['week'], p: null }));
    await ws.owner.data('mutation($w: ID!, $d: ID!) { deleteDocument(workspaceId: $w, documentId: $d) }', vars({ d: ids['specs'] }));
  });

  it("lets members edit their own pages but not other people's", async () => {
    const update = 'mutation($w: ID!, $d: ID!, $input: UpdateDocumentInput!) { updateDocument(workspaceId: $w, documentId: $d, input: $input) { content } }';
    expect((await member.error(update, vars({ d: ids['handbook'], input: { title: 'Mine now' } }))).message).toMatch(/pages you created/);
    const own = await member.data<{ createDocument: { id: string } }>(create, vars({ input: { title: 'Member notes' } }));
    const { updateDocument } = await member.data<{ updateDocument: { content: string } }>(update, vars({ d: own.createDocument.id, input: { content: 'hello' } }));
    expect(updateDocument.content).toBe('hello');
  });

  it('deletes sub-pages with their parent', async () => {
    await ws.owner.data('mutation($w: ID!, $d: ID!) { deleteDocument(workspaceId: $w, documentId: $d) }', vars({ d: ids['handbook'] }));
    const { documents } = await ws.owner.data<{ documents: { title: string }[] }>('query($w: ID!) { documents(workspaceId: $w) { title } }', vars());
    expect(documents.map((doc) => doc.title).sort()).toEqual(['First week', 'Member notes']);
  });
});

describe('HR', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let leaveTypeId: string;
  const requests: string[] = [];
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const requestLeave = 'mutation($w: ID!, $input: RequestLeaveInput!) { requestLeave(workspaceId: $w, input: $input) { id days status } }';
  const decide = 'mutation($w: ID!, $r: ID!, $d: LeaveDecision!) { decideLeaveRequest(workspaceId: $w, requestId: $r, input: { decision: $d }) { status } }';
  const balances = `query($w: ID!) { myLeaveBalances(workspaceId: $w, year: ${LEAVE_YEAR}) { leaveTypeId usedDays remainingDays } }`;

  beforeAll(async () => {
    ws = await createWorkspace('HR owner');
    member = await TestUser.signUp('Employee');
    await addMember(ws, member, 'Member');
  });

  it('manages departments and profiles, and blocks circular reporting lines', async () => {
    const { createDepartment } = await ws.owner.data<{ createDepartment: { id: string; memberCount: number } }>(
      'mutation($w: ID!, $head: ID) { createDepartment(workspaceId: $w, input: { name: "Engineering", headUserId: $head }) { id memberCount } }',
      vars({ head: ws.owner.id }),
    );
    expect(createDepartment.memberCount).toBe(0);
    expect((await member.error('mutation($w: ID!) { createDepartment(workspaceId: $w, input: { name: "Sales" }) { id } }', vars())).code).toBe('FORBIDDEN');

    const upsert = 'mutation($w: ID!, $u: ID!, $input: EmployeeProfileInput!) { upsertEmployeeProfile(workspaceId: $w, userId: $u, input: $input) { departmentName managerUserId } }';
    const profile = await ws.owner.data<{ upsertEmployeeProfile: { departmentName: string } }>(
      upsert,
      vars({ u: member.id, input: { jobTitle: 'Engineer', departmentId: createDepartment.id, managerUserId: ws.owner.id, employmentType: 'full_time', startDate: '2026-01-05' } }),
    );
    expect(profile.upsertEmployeeProfile.departmentName).toBe('Engineering');
    expect((await ws.owner.error(upsert, vars({ u: ws.owner.id, input: { managerUserId: member.id } }))).message).toMatch(/circular/);

    const { employees } = await member.data<{ employees: unknown[] }>('query($w: ID!) { employees(workspaceId: $w) { userId } }', vars());
    expect(employees).toHaveLength(2);
  });

  it('counts working days and blocks overlaps, weekends and over-requests', async () => {
    const { createLeaveType } = await ws.owner.data<{ createLeaveType: { id: string; requiresApproval: boolean } }>(
      'mutation($w: ID!) { createLeaveType(workspaceId: $w, input: { name: "Annual", annualAllowanceDays: 10 }) { id requiresApproval } }',
      vars(),
    );
    expect(createLeaveType.requiresApproval).toBe(true);
    leaveTypeId = createLeaveType.id;
    const leave = (startDate: string, endDate: string) => vars({ input: { leaveTypeId, startDate, endDate, reason: 'Family' } });

    const first = await member.data<{ requestLeave: { id: string; days: number } }>(requestLeave, leave(day(0), day(1)));
    expect(first.requestLeave.days).toBe(2);
    requests.push(first.requestLeave.id);
    expect((await member.error(requestLeave, leave(day(1), day(2)))).message).toMatch(/already have time off/);
    expect((await member.error(requestLeave, leave(day(5), day(6)))).message).toMatch(/no working days/);
    requests.push((await member.data<{ requestLeave: { id: string } }>(requestLeave, leave(day(7), day(8)))).requestLeave.id);
    expect((await member.error(requestLeave, leave(day(14), day(25)))).message).toMatch(/Not enough allowance/);
  });

  it('keeps approvals to approvers, and never lets two approvals overspend a balance', async () => {
    expect((await member.error(decide, vars({ r: requests[0], d: 'approved' }))).code).toBe('FORBIDDEN');
    const queue = await ws.owner.data<{ leaveRequests: { total: number } }>('query($w: ID!) { leaveRequests(workspaceId: $w, status: pending) { total } }', vars());
    expect(queue.leaveRequests.total).toBe(2);

    // Shrink the allowance so only one of the two pending requests fits, then approve both at once.
    await ws.owner.data('mutation($w: ID!, $t: ID!) { updateLeaveType(workspaceId: $w, leaveTypeId: $t, input: { annualAllowanceDays: 3 }) { id } }', vars({ t: leaveTypeId }));
    const results = await Promise.all(requests.map((r) => ws.owner.gql<{ decideLeaveRequest: { status: string } }>(decide, vars({ r, d: 'approved' }))));
    expect(results.filter((result) => result.data?.decideLeaveRequest.status === 'approved')).toHaveLength(1);
    expect(results.filter((result) => result.errors?.[0]?.message.match(/Not enough allowance/))).toHaveLength(1);

    const { myLeaveBalances } = await member.data<{ myLeaveBalances: { leaveTypeId: string; usedDays: number; remainingDays: number }[] }>(balances, vars());
    expect(myLeaveBalances.find((balance) => balance.leaveTypeId === leaveTypeId)).toMatchObject({ usedDays: 2, remainingDays: 1 });

    const winner = requests[results.findIndex((result) => result.data)];
    const cancelled = await member.data<{ cancelLeaveRequest: { status: string } }>(
      'mutation($w: ID!, $r: ID!) { cancelLeaveRequest(workspaceId: $w, requestId: $r) { status } }',
      vars({ r: winner }),
    );
    expect(cancelled.cancelLeaveRequest.status).toBe('cancelled');
    const after = await member.data<{ myLeaveBalances: { leaveTypeId: string; usedDays: number }[] }>(balances, vars());
    expect(after.myLeaveBalances.find((balance) => balance.leaveTypeId === leaveTypeId)?.usedDays).toBe(0);
  });

  it('does not let approvers decide on their own requests', async () => {
    const own = await ws.owner.data<{ requestLeave: { id: string } }>(requestLeave, vars({ input: { leaveTypeId, startDate: day(29), endDate: day(29) } }));
    expect((await ws.owner.error(decide, vars({ r: own.requestLeave.id, d: 'approved' }))).message).toMatch(/own/);
  });

  it('keeps leave types that are in use', async () => {
    const result = await ws.owner.error('mutation($w: ID!, $t: ID!) { deleteLeaveType(workspaceId: $w, leaveTypeId: $t) }', vars({ t: leaveTypeId }));
    expect(result.message).toMatch(/in use/);
  });
});
