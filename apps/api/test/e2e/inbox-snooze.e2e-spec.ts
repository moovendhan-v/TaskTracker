import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const INBOX = 'query($w: ID!, $k: [NotificationKind!], $s: Boolean) { notifications(workspaceId: $w, kinds: $k, snoozed: $s) { items { id kind subject readAt snoozedUntil } } }';
const UNREAD = 'query($w: ID!) { unreadNotificationCount(workspaceId: $w) }';
const SNOOZE = 'mutation($w: ID!, $ids: [ID!]!, $until: String) { snoozeNotifications(workspaceId: $w, ids: $ids, until: $until) }';
const READ = 'mutation($w: ID!, $ids: [ID!]!) { markNotificationsRead(workspaceId: $w, ids: $ids) }';

interface Item {
  id: string;
  kind: string;
  subject: string;
  readAt: string | null;
  snoozedUntil: string | null;
}

/** C6: snoozing inbox items, and filtering the inbox by kind. */
describe('inbox snooze and filters', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let sam: TestUser;
  let mention: Item;
  let comment: Item;
  const inbox = async (user: TestUser, vars: { k?: string[]; s?: boolean } = {}) => (await user.data<{ notifications: { items: Item[] } }>(INBOX, { w, ...vars })).notifications.items;
  const unread = async (user: TestUser) => (await user.data<{ unreadNotificationCount: number }>(UNREAD, { w })).unreadNotificationCount;
  const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

  beforeAll(async () => {
    ws = await createWorkspace('Snooze owner');
    w = ws.workspaceId;
    sam = await TestUser.signUp('Snooze Sam');
    await addMember(ws, sam, 'Member');
    const task = (await ws.owner.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!, $a: ID) { createTask(workspaceId: $w, listId: $l, input: { title: "Quarterly report", assigneeId: $a }) { id } }', { w, l: ws.listId, a: sam.id })).createTask.id;
    await ws.owner.data('mutation($w: ID!, $t: ID!, $b: String!) { createComment(workspaceId: $w, taskId: $t, input: { body: $b }) { id } }', { w, t: task, b: `@{${sam.id}} please review` });
    const end = Date.now() + 5_000;
    let items: Item[] = [];
    while (Date.now() < end && items.length < 2) items = await inbox(sam);
    mention = items.find((item) => item.kind === 'comment_mention')!;
    comment = items.find((item) => item.kind === 'task_assigned')!;
    expect(mention && comment).toBeTruthy();
  });

  it('filters by kind', async () => {
    expect((await inbox(sam, { k: ['chat_mention', 'comment_mention'] })).map((item) => item.kind)).toEqual(['comment_mention']);
    expect((await inbox(sam, { k: ['task_assigned'] })).map((item) => item.kind)).toEqual(['task_assigned']);
    expect(await inbox(sam, { k: ['automation'] })).toEqual([]);
  });

  it('hides a snoozed item, out of the unread count, until it comes back unread', async () => {
    await sam.data(READ, { w, ids: [mention.id] });
    const before = await unread(sam);
    expect((await sam.data<{ snoozeNotifications: number }>(SNOOZE, { w, ids: [comment.id], until: inMinutes(60) })).snoozeNotifications).toBe(1);
    expect((await inbox(sam)).map((item) => item.id)).not.toContain(comment.id);
    expect(await unread(sam)).toBe(before - 1);
    const [snoozed] = await inbox(sam, { s: true });
    expect(snoozed).toMatchObject({ id: comment.id, readAt: null });
    expect(snoozed!.snoozedUntil).toBeTruthy();

    // Back early: unsnooze.
    expect((await sam.data<{ snoozeNotifications: number }>(SNOOZE, { w, ids: [comment.id] })).snoozeNotifications).toBe(1);
    expect((await inbox(sam)).map((item) => item.id)).toContain(comment.id);
    expect(await inbox(sam, { s: true })).toEqual([]);
  });

  it('brings an item back on its own when the time comes, unread and on top', async () => {
    // The mention was read; snoozed briefly, it comes back unread.
    await sam.data(SNOOZE, { w, ids: [mention.id], until: new Date(Date.now() + 1_500).toISOString() });
    expect((await inbox(sam)).map((item) => item.id)).not.toContain(mention.id);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const [first] = await inbox(sam);
    expect(first).toMatchObject({ id: mention.id, readAt: null, snoozedUntil: null });
  });

  it('only snoozes your own, to a time in the next 30 days', async () => {
    expect((await sam.error(SNOOZE, { w, ids: [comment.id], until: inMinutes(-5) })).message).toMatch(/in the future/);
    expect((await sam.error(SNOOZE, { w, ids: [comment.id], until: inMinutes(31 * 24 * 60) })).message).toMatch(/at most 30 days/);
    expect((await ws.owner.data<{ snoozeNotifications: number }>(SNOOZE, { w, ids: [comment.id], until: inMinutes(60) })).snoozeNotifications).toBe(0);
    expect((await inbox(sam)).map((item) => item.id)).toContain(comment.id);
  });
});
