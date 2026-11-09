import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const OFFICE = 'query($w: ID!) { office(workspaceId: $w) { people { userId name x y status chosenStatus zoneId } } }';
const HEARTBEAT = 'mutation($w: ID!) { officeHeartbeat(workspaceId: $w) { userId x y status zoneId } }';
const MOVE = 'mutation($w: ID!, $x: Int!, $y: Int!) { moveInOffice(workspaceId: $w, x: $x, y: $y) { x y status zoneId } }';
const STATUS = 'mutation($w: ID!, $s: String!) { setOfficeStatus(workspaceId: $w, status: $s) { status chosenStatus } }';
const LEAVE = 'mutation($w: ID!) { leaveOffice(workspaceId: $w) }';
const ROOM = 'mutation($w: ID!, $z: String!) { officeMeetingRoom(workspaceId: $w, zoneId: $z) }';
const CHANNEL = 'query($w: ID!, $c: ID!) { chatChannel(workspaceId: $w, channelId: $c) { name kind topic } }';
const JOIN = 'mutation($w: ID!, $c: ID!) { joinCall(workspaceId: $w, channelId: $c) { callId } }';

interface Person {
  userId: string;
  name: string;
  x: number;
  y: number;
  status: string;
  chosenStatus: string;
  zoneId: string | null;
}

/** D3: the virtual office. */
describe('virtual office', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let outsider: TestUser;
  const people = async (user: TestUser) => (await user.data<{ office: { people: Person[] } }>(OFFICE, { w })).office.people;
  const find = async (user: TestUser, id: string) => (await people(user)).find((person) => person.userId === id);

  beforeAll(async () => {
    ws = await createWorkspace('Office owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Office member');
    outsider = await TestUser.signUp('Office outsider');
    await addMember(ws, member, 'Member');
  });

  it('puts you at a free desk when you open it, and shows everyone who is there', async () => {
    const owner = (await ws.owner.data<{ officeHeartbeat: Person }>(HEARTBEAT, { w })).officeHeartbeat;
    const other = (await member.data<{ officeHeartbeat: Person }>(HEARTBEAT, { w })).officeHeartbeat;
    expect(owner).toMatchObject({ zoneId: 'desks', status: 'available' });
    expect(other.zoneId).toBe('desks');
    expect([other.x, other.y]).not.toEqual([owner.x, owner.y]);
    expect((await people(member)).map((person) => person.name).sort()).toEqual(['Office member', 'Office owner']);
    // Not for outsiders.
    expect((await outsider.error(OFFICE, { w })).code).toBe('NOT_FOUND');
  });

  it('moves you only onto the floor and never onto someone', async () => {
    const owner = (await find(ws.owner, ws.owner.id))!;
    expect((await member.error(MOVE, { w, x: owner.x, y: owner.y })).message).toMatch(/Someone is standing there/);
    expect((await member.error(MOVE, { w, x: 0, y: 3 })).message).toMatch(/isn’t on the floor/);
    expect((await member.error(MOVE, { w, x: 23, y: 3 })).message).toMatch(/isn’t on the floor/);
    // The focus area makes you show as focused.
    expect((await member.data<{ moveInOffice: Person }>(MOVE, { w, x: 2, y: 9 })).moveInOffice).toMatchObject({ zoneId: 'focus', status: 'focused' });
    expect((await find(ws.owner, member.id))?.status).toBe('focused');
  });

  it('lets you change only yourself, and works out meetings and offline', async () => {
    expect((await member.data<{ setOfficeStatus: Person }>(STATUS, { w, s: 'away' })).setOfficeStatus).toMatchObject({ status: 'away', chosenStatus: 'away' });
    expect((await member.error(STATUS, { w, s: 'in_meeting' })).message).toMatch(/available, focused or away/);
    // Even in SQL, nobody can move someone else.
    const pool = runtimeDatabase();
    try {
      const moved = await withScope(pool, { workspaceId: w, userId: member.id }, async (client) => (await client.query('UPDATE office_presence SET x = 5 WHERE user_id = $1', [ws.owner.id])).rowCount);
      expect(moved).toBe(0);
    } finally {
      await pool.end();
    }

    // A meeting room is an ordinary public channel; being in its huddle shows as in a meeting.
    const channelId = (await member.data<{ officeMeetingRoom: string }>(ROOM, { w, z: 'aurora' })).officeMeetingRoom;
    expect((await ws.owner.data<{ officeMeetingRoom: string }>(ROOM, { w, z: 'aurora' })).officeMeetingRoom).toBe(channelId);
    expect((await member.data<{ chatChannel: { name: string; kind: string } }>(CHANNEL, { w, c: channelId })).chatChannel).toMatchObject({ name: 'room-aurora', kind: 'public' });
    expect((await member.error(ROOM, { w, z: 'desks' })).code).toBe('NOT_FOUND');
    await member.data(JOIN, { w, c: channelId });

    // Leaving the page: offline at once.
    expect((await member.data<{ leaveOffice: boolean }>(LEAVE, { w })).leaveOffice).toBe(true);
    expect((await find(ws.owner, member.id))?.status).toBe('offline');
    // Back: your spot again (nobody took it), and your chosen state.
    expect((await member.data<{ officeHeartbeat: Person }>(HEARTBEAT, { w })).officeHeartbeat).toMatchObject({ x: 2, y: 9, status: 'away' });
  });
});
