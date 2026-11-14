import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace } from './support/fixtures.js';

const LIST = 'query($w: ID!) { docTemplates(workspaceId: $w) { id name description content builtIn createdById } }';
const SAVE = 'mutation($w: ID!, $input: SaveDocTemplateInput!) { saveDocTemplate(workspaceId: $w, input: $input) { id name content builtIn } }';
const DELETE = 'mutation($w: ID!, $t: ID!) { deleteDocTemplate(workspaceId: $w, templateId: $t) }';

type Template = { id: string; name: string; description: string; content: string; builtIn: boolean; createdById: string | null };

describe('doc templates', () => {
  it('lists the starters, keeps a workspace’s own (sanitized), and lets only their saver or a doc manager delete them', async () => {
    const ws = await createWorkspace('Doc templates');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Doc templates member');
    const guest = await TestUser.signUp('Doc templates guest');
    await addMember(ws, member, 'Member');
    await addMember(ws, guest, 'Guest');
    const list = async (user: TestUser) => (await user.data<{ docTemplates: Template[] }>(LIST, { w })).docTemplates;

    // The built-in starters, for anyone who can read docs.
    const starters = await list(guest);
    expect(starters.map((item) => item.name)).toEqual(['Meeting notes', 'Project brief', 'Retrospective', 'Decision record']);
    expect(starters.every((item) => item.builtIn)).toBe(true);

    // Saving needs doc.create, and the text is sanitized like a page's.
    expect((await guest.error(SAVE, { w, input: { name: 'Nope', content: 'x' } })).code).toBe('FORBIDDEN');
    const standup = (await member.data<{ saveDocTemplate: Template }>(SAVE, { w, input: { name: 'Stand-up', content: '# Stand-up {{date}}\n\n[help](javascript:alert(1))\n\n- Yesterday\n- Today' } })).saveDocTemplate;
    expect(standup.builtIn).toBe(false);
    expect(standup.content).toContain('{{date}}');
    // Like a page: unsafe link schemes are blocked (raw HTML is never rendered as markup anyway).
    expect(standup.content).not.toMatch(/javascript:/i);
    expect((await member.error(SAVE, { w, input: { name: '   ', content: 'x' } })).code).toBe('BAD_USER_INPUT');
    expect((await list(guest)).map((item) => item.name)).toContain('Stand-up');

    // Delete: not someone else's (unless you manage docs); built-ins can't be deleted.
    const ownersOwn = (await ws.owner.data<{ saveDocTemplate: Template }>(SAVE, { w, input: { name: 'Owner notes', content: 'x' } })).saveDocTemplate;
    expect((await member.error(DELETE, { w, t: ownersOwn.id })).code).toBe('FORBIDDEN');
    expect((await guest.error(DELETE, { w, t: standup.id })).code).toBe('FORBIDDEN');
    expect((await member.error(DELETE, { w, t: 'builtin:meeting-notes' })).code).toBe('BAD_USER_INPUT');
    expect((await ws.owner.data<{ deleteDocTemplate: boolean }>(DELETE, { w, t: standup.id })).deleteDocTemplate).toBe(true);
    expect((await list(member)).map((item) => item.name)).toEqual(['Meeting notes', 'Project brief', 'Retrospective', 'Decision record', 'Owner notes']);

    // Another workspace sees only the starters, and can't delete this one's.
    const other = await createWorkspace('Doc templates outsider');
    expect((await other.owner.error(LIST, { w })).code).toMatch(/FORBIDDEN|NOT_FOUND/);
    expect((await other.owner.data<{ docTemplates: Template[] }>(LIST, { w: other.workspaceId })).docTemplates.every((item) => item.builtIn)).toBe(true);
    expect((await other.owner.error(DELETE, { w: other.workspaceId, t: ownersOwn.id })).code).toBe('NOT_FOUND');
  });
});
