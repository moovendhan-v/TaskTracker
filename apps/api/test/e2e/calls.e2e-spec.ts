import { createHash } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { E2E_LIVEKIT_KEY, E2E_LIVEKIT_SECRET } from './support/test-env.js';

const CREATE = 'mutation($w: ID!, $input: CreateChatChannelInput!) { createChatChannel(workspaceId: $w, input: $input) { id } }';
const MESSAGES = 'query($w: ID!, $c: ID!) { chatMessages(workspaceId: $w, channelId: $c) { items { body kind } } }';
const OVERVIEW = 'query($w: ID!) { callsOverview(workspaceId: $w) { enabled calls { id channelId startedById participants { userId name } } } }';
const JOIN = 'mutation($w: ID!, $c: ID!) { joinCall(workspaceId: $w, channelId: $c) { callId channelId url token } }';

interface Join {
  callId: string;
  channelId: string;
  url: string;
  token: string;
}
interface Overview {
  enabled: boolean;
  calls: { id: string; channelId: string; startedById: string; participants: { userId: string; name: string }[] }[];
}

const claims = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString()) as Record<string, unknown> & { video: Record<string, unknown>; exp: number; nbf: number };

let eventCounter = 0;
/** Sends a webhook the way LiveKit does: a JWT over the body's SHA-256, signed with the API secret. */
async function webhook(event: string, room: string, identity: string | null, { secret = E2E_LIVEKIT_SECRET, id = `EV_${++eventCounter}_${Date.now()}` } = {}): Promise<Response> {
  const body = JSON.stringify({ event, id, room: { name: room }, ...(identity && { participant: { identity } }), createdAt: String(Math.floor(Date.now() / 1000)) });
  const token = new AccessToken(E2E_LIVEKIT_KEY, secret);
  token.sha256 = createHash('sha256').update(body).digest('base64');
  return fetch(`${inject('apiUrl')}/api/integrations/livekit/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/webhook+json', Authorization: await token.toJwt() },
    body,
  });
}

/** D2: calls (huddles) in chat channels. */
describe('calls', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let outsider: TestUser;
  let general: string;
  let privateRoom: string;

  beforeAll(async () => {
    ws = await createWorkspace('Call owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Call member');
    outsider = await TestUser.signUp('Call outsider');
    await addMember(ws, member, 'Member');
    await addMember(ws, outsider, 'Member');
    general = (await ws.owner.data<{ createChatChannel: { id: string } }>(CREATE, { w, input: { name: 'huddles', kind: 'public' } })).createChatChannel.id;
    privateRoom = (await ws.owner.data<{ createChatChannel: { id: string } }>(CREATE, { w, input: { name: 'leads', kind: 'private', memberIds: [member.id] } })).createChatChannel.id;
  });

  it('hands out a short-lived token for one room, as you', async () => {
    expect((await ws.owner.data<{ callsOverview: Overview }>(OVERVIEW, { w })).callsOverview).toEqual({ enabled: true, calls: [] });
    const join = (await ws.owner.data<{ joinCall: Join }>(JOIN, { w, c: general })).joinCall;
    expect(join.url).toBe('ws://127.0.0.1:7880');
    const token = claims(join.token);
    expect(token['sub']).toBe(ws.owner.id);
    expect(token['name']).toBe('Call owner');
    expect(token['iss']).toBe(E2E_LIVEKIT_KEY);
    expect(token.exp - token.nbf).toBe(600);
    expect(token.video).toMatchObject({ room: `tf-${join.callId}`, roomJoin: true, canPublish: true, canSubscribe: true, canUpdateOwnMetadata: false });
    expect(token.video['roomAdmin']).toBeUndefined();

    // Chat says so, once.
    const messages = (await ws.owner.data<{ chatMessages: { items: { body: string; kind: string }[] } }>(MESSAGES, { w, c: general })).chatMessages.items;
    expect(messages.filter((message) => message.kind === 'system').map((message) => message.body)).toEqual(['started a huddle']);
  });

  it('puts everyone joining the channel into the same call, and joining it joins a public channel', async () => {
    const first = (await ws.owner.data<{ joinCall: Join }>(JOIN, { w, c: general })).joinCall;
    const second = (await outsider.data<{ joinCall: Join }>(JOIN, { w, c: general })).joinCall;
    expect(second.callId).toBe(first.callId);
    expect((await outsider.data<{ chatMessages: { items: unknown[] } }>(MESSAGES, { w, c: general })).chatMessages.items.length).toBeGreaterThan(0);
    const messages = (await ws.owner.data<{ chatMessages: { items: { kind: string }[] } }>(MESSAGES, { w, c: general })).chatMessages.items;
    expect(messages.filter((message) => message.kind === 'system')).toHaveLength(1);
  });

  it("keeps private channels' calls to their members", async () => {
    expect((await outsider.error(JOIN, { w, c: privateRoom })).code).toBe('NOT_FOUND');
    const join = (await member.data<{ joinCall: Join }>(JOIN, { w, c: privateRoom })).joinCall;
    const seen = (await outsider.data<{ callsOverview: Overview }>(OVERVIEW, { w })).callsOverview.calls.map((call) => call.channelId);
    expect(seen).not.toContain(privateRoom);
    expect((await member.data<{ callsOverview: Overview }>(OVERVIEW, { w })).callsOverview.calls.map((call) => call.id)).toContain(join.callId);
  });

  it('only believes webhooks signed with the API secret, and handles each once', async () => {
    const { callId } = (await ws.owner.data<{ joinCall: Join }>(JOIN, { w, c: general })).joinCall;
    const room = `tf-${callId}`;
    expect((await webhook('participant_joined', room, ws.owner.id, { secret: 'not-the-secret-0123456789abcdefgh' })).status).toBe(401);
    const unsigned = await fetch(`${inject('apiUrl')}/api/integrations/livekit/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/webhook+json' }, body: '{"event":"room_finished"}' });
    expect(unsigned.status).toBe(401);

    expect((await webhook('participant_joined', room, ws.owner.id)).status).toBe(200);
    const once = `EV_once_${Date.now()}`;
    expect(await (await webhook('participant_joined', room, outsider.id, { id: once })).json()).toEqual({ result: 'ok' });
    // LiveKit retries a delivery it isn't sure arrived: the same event id is ignored.
    expect(await (await webhook('participant_left', room, outsider.id, { id: once })).json()).toEqual({ result: 'ignored' });

    const call = (await member.data<{ callsOverview: Overview }>(OVERVIEW, { w })).callsOverview.calls.find((item) => item.id === callId)!;
    expect(call.participants.map((person) => person.name).sort()).toEqual(['Call outsider', 'Call owner']);

    await webhook('participant_left', room, outsider.id);
    expect((await member.data<{ callsOverview: Overview }>(OVERVIEW, { w })).callsOverview.calls.find((item) => item.id === callId)!.participants.map((person) => person.name)).toEqual(['Call owner']);
  });

  it('ends when LiveKit says the room finished, and chat shows how it went', async () => {
    const { callId } = (await ws.owner.data<{ joinCall: Join }>(JOIN, { w, c: general })).joinCall;
    expect((await webhook('room_finished', `tf-${callId}`, null)).status).toBe(200);
    expect((await ws.owner.data<{ callsOverview: Overview }>(OVERVIEW, { w })).callsOverview.calls.map((call) => call.id)).not.toContain(callId);
    const lines = (await ws.owner.data<{ chatMessages: { items: { body: string; kind: string }[] } }>(MESSAGES, { w, c: general })).chatMessages.items.filter((message) => message.kind === 'system').map((message) => message.body);
    expect(lines).toContain('Huddle ended · under a minute · 2 people');
    // A new call starts fresh, with its own line.
    const next = (await ws.owner.data<{ joinCall: Join }>(JOIN, { w, c: general })).joinCall;
    expect(next.callId).not.toBe(callId);
  });
});
