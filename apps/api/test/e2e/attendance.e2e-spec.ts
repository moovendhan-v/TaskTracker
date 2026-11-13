import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const SHIFT = 'id userId startedAt endedAt onBreak workedMinutes breaks { start end } correctedAt correctedById correctionReason';
const MINE = `query($w: ID!) { myAttendance(workspaceId: $w) { current { ${SHIFT} } recent { ${SHIFT} } } }`;
const action = (name: string) => `mutation($w: ID!) { ${name}(workspaceId: $w) { ${SHIFT} } }`;
const TEAM = `query($w: ID!, $from: String!, $to: String!) { teamAttendance(workspaceId: $w, from: $from, to: $to) { ${SHIFT} } }`;

interface Shift {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  onBreak: boolean;
  workedMinutes: number;
  breaks: { start: string; end: string | null }[];
  correctedAt: string | null;
  correctedById: string | null;
  correctionReason: string | null;
}

const CORRECT = `mutation($w: ID!, $id: ID!, $input: CorrectAttendanceShiftInput!) { correctAttendanceShift(workspaceId: $w, shiftId: $id, input: $input) { ${SHIFT} } }`;
const EXPORT = `mutation($w: ID!, $from: String!, $to: String!, $tz: String!) { exportAttendance(workspaceId: $w, from: $from, to: $to, timeZone: $tz) { fileName content shifts truncated } }`;
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

describe('attendance: clock in, breaks, clock out', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let w: string;
  let db: pg.Pool;
  const run = async (user: TestUser, name: string) => ((await user.data<Record<string, Shift>>(action(name), { w })) as Record<string, Shift>)[name]!;
  const range = () => ({ w, from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date(Date.now() + 86_400_000).toISOString() });

  beforeAll(async () => {
    db = runtimeDatabase();
    ws = await createWorkspace('Attendance owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Attendance member');
    await addMember(ws, member, 'Member');
  });

  afterAll(async () => {
    await db.end();
  });

  it('clocks in once, takes a break, and clocks out at the server’s time', async () => {
    const before = Date.now();
    const shift = await run(member, 'clockIn');
    expect(shift.endedAt).toBeNull();
    expect(Date.parse(shift.startedAt)).toBeGreaterThanOrEqual(before - 5_000);
    // A second clock-in (another tab, a double click) is refused; so is ending a break that isn't running.
    expect((await member.error(action('clockIn'), { w })).code).toBe('CONFLICT');
    expect((await member.error(action('endBreak'), { w })).message).toMatch(/not on a break/);

    expect((await run(member, 'startBreak')).onBreak).toBe(true);
    expect((await member.error(action('startBreak'), { w })).message).toMatch(/already on a break/);
    expect((await member.data<{ myAttendance: { current: Shift } }>(MINE, { w })).myAttendance.current.onBreak).toBe(true);

    // Clocking out ends the running break too.
    const done = await run(member, 'clockOut');
    expect(done.id).toBe(shift.id);
    expect(done.endedAt).not.toBeNull();
    expect(done.onBreak).toBe(false);
    expect(done.breaks).toHaveLength(1);
    expect(done.breaks[0]!.end).not.toBeNull();
    expect((await member.error(action('clockOut'), { w })).message).toMatch(/not clocked in/);

    const mine = (await member.data<{ myAttendance: { current: Shift | null; recent: Shift[] } }>(MINE, { w })).myAttendance;
    expect(mine.current).toBeNull();
    expect(mine.recent.map((item) => item.id)).toEqual([shift.id]);
    // And a fresh day starts a new shift.
    expect((await run(member, 'clockIn')).id).not.toBe(shift.id);
    await run(member, 'clockOut');
  });

  it('shows the team’s shifts to HR managers only, within a month', async () => {
    await run(ws.owner, 'clockIn');
    const team = (await ws.owner.data<{ teamAttendance: Shift[] }>(TEAM, range())).teamAttendance;
    expect(new Set(team.map((item) => item.userId))).toEqual(new Set([member.id, ws.owner.id]));
    expect(team.find((item) => item.userId === ws.owner.id)!.endedAt).toBeNull();
    expect((await member.error(TEAM, range())).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(TEAM, { w, from: '2026-01-01T00:00:00Z', to: '2026-03-01T00:00:00Z' })).message).toMatch(/At most 31 days/);
    await run(ws.owner, 'clockOut');
  });

  it('lets nobody write another person’s shifts, even past the API', async () => {
    const rows = await withScope(db, { workspaceId: w, userId: member.id }, async (client) => {
      const updated = await client.query(`UPDATE attendance_shift SET ended_at = started_at WHERE user_id = $1`, [ws.owner.id]);
      const read = await client.query(`SELECT count(*)::int AS n FROM attendance_shift WHERE user_id = $1`, [ws.owner.id]);
      return { updated: updated.rowCount, seen: read.rows[0].n };
    });
    expect(rows.updated).toBe(0);
    expect(rows.seen).toBeGreaterThan(0);
    await expect(
      withScope(db, { workspaceId: w, userId: member.id }, (client) => client.query(`INSERT INTO attendance_shift (workspace_id, user_id, started_at) VALUES ($1, $2, now())`, [w, ws.owner.id])),
    ).rejects.toThrow(/row-level security/);
    const other = await createWorkspace('Attendance other');
    const leaked = await withScope(db, { workspaceId: other.workspaceId, userId: other.owner.id }, async (client) => (await client.query(`SELECT count(*)::int AS n FROM attendance_shift`)).rows[0].n);
    expect(leaked).toBe(0);
  });

  it('lets HR correct a forgotten clock-out, keeping breaks inside, and audits it', async () => {
    const open = await run(member, 'clockIn');
    await run(member, 'startBreak');
    const input = { startedAt: ago(9), endedAt: ago(1), reason: 'Forgot to clock out' };
    // Only HR, only sensible times, and never on top of another shift.
    expect((await member.error(CORRECT, { w, id: open.id, input })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(CORRECT, { w, id: open.id, input: { ...input, endedAt: ago(-1) } })).message).toMatch(/future/);
    expect((await ws.owner.error(CORRECT, { w, id: open.id, input: { ...input, endedAt: ago(10) } })).message).toMatch(/end after it starts/);
    expect((await ws.owner.error(CORRECT, { w, id: open.id, input: { ...input, startedAt: ago(30) } })).message).toMatch(/at most 24 hours/);
    expect((await ws.owner.error(CORRECT, { w, id: open.id, input: { ...input, reason: '  ' } })).message).toMatch(/Say why/);
    expect((await ws.owner.error(CORRECT, { w, id: open.id, input: { ...input, endedAt: ago(0) } })).code).toBe('CONFLICT');

    const fixed = (await ws.owner.data<{ correctAttendanceShift: Shift }>(CORRECT, { w, id: open.id, input })).correctAttendanceShift;
    expect(fixed).toMatchObject({ id: open.id, userId: member.id, startedAt: input.startedAt, endedAt: input.endedAt, onBreak: false, correctedById: ws.owner.id, correctionReason: 'Forgot to clock out' });
    // The break taken just now is outside the corrected shift, so it goes.
    expect(fixed.breaks).toEqual([]);
    expect(fixed.workedMinutes).toBe(480);
    // The member is clocked out now, and sees the correction.
    const mine = (await member.data<{ myAttendance: { current: Shift | null; recent: Shift[] } }>(MINE, { w })).myAttendance;
    expect(mine.current).toBeNull();
    expect(mine.recent.find((item) => item.id === open.id)!.correctionReason).toBe('Forgot to clock out');

    const audit = await withScope(db, { platform: true }, async (client) =>
      (await client.query<{ action: string; actor_id: string; metadata: { userId: string; before: { endedAt: string | null }; after: { endedAt: string } } }>(
        "SELECT action, actor_id, metadata FROM audit_log WHERE target_id = $1 AND action = 'attendance.correct'",
        [open.id],
      )).rows,
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_id: ws.owner.id, metadata: { userId: member.id, before: { endedAt: null }, after: { endedAt: input.endedAt } } });

    // Another workspace's HR can't reach it.
    const other = await createWorkspace('Attendance other HR');
    expect((await other.owner.error(CORRECT, { w: other.workspaceId, id: open.id, input })).code).toBe('NOT_FOUND');
  });

  it('exports the team’s shifts as CSV for HR only, audited', async () => {
    const vars = { ...range(), from: ago(24), tz: 'Europe/Berlin' };
    const exported = (await ws.owner.data<{ exportAttendance: { fileName: string; content: string; shifts: number; truncated: boolean } }>(EXPORT, vars)).exportAttendance;
    expect(exported.fileName).toMatch(/^attendance-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(exported.truncated).toBe(false);
    const lines = exported.content.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
    expect(lines[0]).toMatch(/^"Person","Date","Clock in"/);
    expect(lines).toHaveLength(exported.shifts + 1);
    expect(lines.some((line) => line.startsWith('"Attendance member"') && line.endsWith('"Forgot to clock out"'))).toBe(true);
    expect((await member.error(EXPORT, vars)).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(EXPORT, { ...vars, tz: 'Nowhere/Land' })).message).toMatch(/time zone/);
    const audited = await withScope(db, { platform: true }, async (client) =>
      (await client.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE workspace_id = $1 AND action = 'attendance.export'", [w])).rows[0]!.n,
    );
    expect(audited).toBe(1);
  });
});
