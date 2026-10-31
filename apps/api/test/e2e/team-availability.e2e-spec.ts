import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace } from './support/fixtures.js';

const AVAILABILITY = 'query($w: ID!, $from: String!, $to: String!) { teamAvailability(workspaceId: $w, from: $from, to: $to) { userId startDate endDate } }';
const REQUEST = 'mutation($w: ID!, $input: RequestLeaveInput!) { requestLeave(workspaceId: $w, input: $input) { id } }';
const DECIDE = 'mutation($w: ID!, $r: ID!, $d: LeaveDecision!) { decideLeaveRequest(workspaceId: $w, requestId: $r, input: { decision: $d }) { status } }';

describe('team availability for sprint planning', () => {
  it('shows approved leave as dates only, to people who plan sprints', async () => {
    const ws = await createWorkspace('Availability owner');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Availability member');
    await addMember(ws, member, 'Member');
    const me = await member.data<{ me: { id: string } }>('{ me { id } }');
    const { createLeaveType } = await ws.owner.data<{ createLeaveType: { id: string } }>(
      'mutation($w: ID!) { createLeaveType(workspaceId: $w, input: { name: "Sick", annualAllowanceDays: 10 }) { id } }',
      { w },
    );
    const ask = async (startDate: string, endDate: string) =>
      (await member.data<{ requestLeave: { id: string } }>(REQUEST, { w, input: { leaveTypeId: createLeaveType.id, startDate, endDate, reason: 'Private reason' } })).requestLeave.id;
    const approved = await ask('2026-11-03', '2026-11-04');
    await ask('2026-11-10', '2026-11-10'); // still pending: not shown
    await ws.owner.data(DECIDE, { w, r: approved, d: 'approved' });

    const { teamAvailability } = await ws.owner.data<{ teamAvailability: Record<string, unknown>[] }>(AVAILABILITY, { w, from: '2026-11-02', to: '2026-11-13' });
    expect(teamAvailability).toEqual([{ userId: me.me.id, startDate: '2026-11-03', endDate: '2026-11-04' }]);

    // The type and reason are not part of the answer at all.
    expect((await ws.owner.gql('query($w: ID!) { teamAvailability(workspaceId: $w, from: "2026-11-02", to: "2026-11-13") { reason } }', { w })).errors?.[0]?.message).toMatch(/Cannot query field "reason"/);

    // Outside the range: nothing.
    expect((await ws.owner.data<{ teamAvailability: unknown[] }>(AVAILABILITY, { w, from: '2026-12-01', to: '2026-12-10' })).teamAvailability).toEqual([]);
  });

  it('needs sprint.manage and a sensible range', async () => {
    const ws = await createWorkspace('Availability rules');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Availability plain member');
    await addMember(ws, member, 'Member');
    expect((await member.error(AVAILABILITY, { w, from: '2026-11-02', to: '2026-11-13' })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(AVAILABILITY, { w, from: '2026-11-13', to: '2026-11-02' })).message).toMatch(/on or after/);
    expect((await ws.owner.error(AVAILABILITY, { w, from: '2026-01-01', to: '2026-06-01' })).message).toMatch(/At most 92 days/);
    expect((await ws.owner.error(AVAILABILITY, { w, from: 'yesterday', to: '2026-06-01' })).message).toMatch(/yyyy-mm-dd/);
  });
});
