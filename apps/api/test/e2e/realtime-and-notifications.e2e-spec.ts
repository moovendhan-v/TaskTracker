import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { subscribeToWorkspace, type LiveSubscription } from './support/realtime.js';

describe('live workspace events over WebSocket', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let colleague: TestUser;
  const open: LiveSubscription[] = [];
  const live = async (user: TestUser | null, workspaceId = ws.workspaceId, origin?: string | null) => {
    const subscription = await subscribeToWorkspace(user, workspaceId, origin);
    open.push(subscription);
    return subscription;
  };

  beforeAll(async () => {
    ws = await createWorkspace('Live owner');
    member = await TestUser.signUp('Live member');
    colleague = await TestUser.signUp('Live colleague');
    await addMember(ws, member, 'Member');
    await addMember(ws, colleague, 'Member');
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((subscription) => subscription.close()));
  });

  it("pushes other members' changes as they happen", async () => {
    const feed = await live(member);
    const { createTask } = await ws.owner.data<{ createTask: { id: string } }>(
      'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Live task" }) { id } }',
      { w: ws.workspaceId, l: ws.listId },
    );
    const event = await feed.waitFor((e) => e.entityId === createTask.id);
    expect(event).toEqual({ type: 'task.created', entityType: 'task', entityId: createTask.id, actorId: ws.owner.id });
  });

  it('delivers a notification only to its recipient, and fills their inbox', async () => {
    const count = 'query($w: ID!) { unreadNotificationCount(workspaceId: $w) }';
    const colleagueBefore = (await colleague.data<{ unreadNotificationCount: number }>(count, { w: ws.workspaceId })).unreadNotificationCount;
    const memberFeed = await live(member);
    const colleagueFeed = await live(colleague);
    await ws.owner.data(
      'mutation($w: ID!, $l: ID!, $a: ID) { createTask(workspaceId: $w, listId: $l, input: { title: "Yours now", assigneeId: $a }) { id } }',
      { w: ws.workspaceId, l: ws.listId, a: member.id },
    );
    await memberFeed.waitFor((e) => e.type === 'notification.created');
    await colleagueFeed.waitFor((e) => e.type === 'task.created');
    expect(colleagueFeed.events.some((e) => e.type === 'notification.created')).toBe(false);

    const inbox = await member.data<{ notifications: { total: number; items: { id: string; kind: string; subject: string; actorName: string; readAt: string | null }[] } }>(
      'query($w: ID!) { notifications(workspaceId: $w, unreadOnly: true) { total items { id kind subject actorName readAt } } }',
      { w: ws.workspaceId },
    );
    expect(inbox.notifications.items[0]).toMatchObject({ kind: 'task_assigned', subject: 'Yours now', actorName: 'Live owner', readAt: null });

    expect((await member.data<{ unreadNotificationCount: number }>(count, { w: ws.workspaceId })).unreadNotificationCount).toBe(inbox.notifications.total);
    expect((await colleague.data<{ unreadNotificationCount: number }>(count, { w: ws.workspaceId })).unreadNotificationCount).toBe(colleagueBefore);

    // Someone else can't mark it read.
    const ids = inbox.notifications.items.map((n) => n.id);
    const markRead = 'mutation($w: ID!, $ids: [ID!]!) { markNotificationsRead(workspaceId: $w, ids: $ids) }';
    expect((await colleague.data<{ markNotificationsRead: number }>(markRead, { w: ws.workspaceId, ids })).markNotificationsRead).toBe(0);
    expect((await member.data<{ markNotificationsRead: number }>(markRead, { w: ws.workspaceId, ids })).markNotificationsRead).toBe(ids.length);
    expect((await member.data<{ unreadNotificationCount: number }>(count, { w: ws.workspaceId })).unreadNotificationCount).toBe(0);
  });

  it("notifies a task's assignee about comments, but not the comment's author", async () => {
    const { createTask } = await ws.owner.data<{ createTask: { id: string } }>(
      'mutation($w: ID!, $l: ID!, $a: ID) { createTask(workspaceId: $w, listId: $l, input: { title: "Discuss", assigneeId: $a }) { id } }',
      { w: ws.workspaceId, l: ws.listId, a: colleague.id },
    );
    await colleague.data('mutation($w: ID!) { markAllNotificationsRead(workspaceId: $w) }', { w: ws.workspaceId });
    await member.data('mutation($w: ID!, $t: ID!) { createComment(workspaceId: $w, taskId: $t, input: { body: "Can I help?" }) { id } }', {
      w: ws.workspaceId,
      t: createTask.id,
    });
    const inbox = await colleague.data<{ notifications: { items: { kind: string; excerpt: string }[] } }>(
      'query($w: ID!) { notifications(workspaceId: $w, unreadOnly: true) { items { kind excerpt } } }',
      { w: ws.workspaceId },
    );
    expect(inbox.notifications.items).toEqual([{ kind: 'task_commented', excerpt: 'Can I help?' }]);
    const author = await member.data<{ notifications: { items: { kind: string }[] } }>(
      'query($w: ID!) { notifications(workspaceId: $w, unreadOnly: true) { items { kind } } }',
      { w: ws.workspaceId },
    );
    expect(author.notifications.items.some((n) => n.kind === 'task_commented')).toBe(false);
  });

  it("doesn't let outsiders subscribe to a workspace", async () => {
    const outsider = await TestUser.signUp('Live outsider');
    const feed = await live(outsider);
    await ws.owner.data('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Secret" }) { id } }', {
      w: ws.workspaceId,
      l: ws.listId,
    });
    await new Promise((done) => setTimeout(done, 500));
    expect(feed.events).toEqual([]);
    expect(JSON.stringify(feed.errors)).toMatch(/Not Found|NOT_FOUND/i);
  });

  it('refuses sockets without a session or from another site', async () => {
    const anonymous = await live(null);
    const crossSite = await live(member, ws.workspaceId, 'https://evil.example');
    const noOrigin = await live(member, ws.workspaceId, null);
    for (const feed of [anonymous, crossSite, noOrigin]) {
      expect(feed.events).toEqual([]);
      expect(feed.errors.length + (feed.completed ? 1 : 0)).toBeGreaterThan(0);
    }
  });
});
