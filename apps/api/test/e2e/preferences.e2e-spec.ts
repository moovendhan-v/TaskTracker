import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';

const PREFS = `theme accent density radius font sidebarCollapsed sidebarWidth defaultTaskView taskDetailMode dateFormat timeFormat weekStart
  tables { key columns hidden widths { column width } pageSize sort { field direction } }
  savedViews { id name resource scope where pinned color filter { and { field op value values } } }
  tabs { id path title pinned }`;

describe('user preferences', () => {
  it('starts from defaults and saves settings that follow the user', async () => {
    const user = await TestUser.signUp('Prefs');
    const { myPreferences } = await user.data<{ myPreferences: Record<string, unknown> }>(`{ myPreferences { ${PREFS} } }`);
    expect(myPreferences).toMatchObject({ theme: 'system', accent: 'orange', density: 'default', radius: 'md', font: 'geist', tables: [], savedViews: [], tabs: [] });

    await user.data(`mutation { updatePreferences(input: { theme: "dark", accent: "teal", density: "compact", radius: "lg", font: "inter", sidebarWidth: 300 }) { theme } }`);
    const again = await user.data<{ myPreferences: Record<string, unknown> }>(`{ myPreferences { ${PREFS} } }`);
    expect(again.myPreferences).toMatchObject({ theme: 'dark', accent: 'teal', density: 'compact', radius: 'lg', font: 'inter', sidebarWidth: 300, dateFormat: 'MM/DD/YYYY' });

    // Someone else's preferences are their own.
    const other = await TestUser.signUp('Prefs other');
    expect((await other.data<{ myPreferences: { theme: string } }>('{ myPreferences { theme } }')).myPreferences.theme).toBe('system');
  });

  it('validates every setting against the published rules', async () => {
    const user = await TestUser.signUp('Prefs validation');
    const error = (await user.gql('mutation { updatePreferences(input: { theme: "neon", radius: "xl", font: "comic", sidebarWidth: 5000 }) { theme } }')).errors?.[0] as {
      extensions?: { code?: string; fields?: { field: string }[] };
    };
    expect(error.extensions?.code).toBe('BAD_USER_INPUT');
    expect(error.extensions?.fields?.map((field) => field.field).sort()).toEqual(['font', 'radius', 'sidebarWidth', 'theme']);
  });

  it('stores table layouts and saved views, replacing by key or id', async () => {
    const user = await TestUser.signUp('Prefs tables');
    const layout = 'mutation($input: TableLayoutInput!) { saveTableLayout(input: $input) { tables { key columns hidden widths { column width } pageSize } } }';
    await user.data(layout, { input: { key: 'tasks', columns: ['title', 'status'], hidden: ['metadata'], widths: [{ column: 'title', width: 320 }], pageSize: 25 } });
    const { saveTableLayout } = await user.data<{ saveTableLayout: { tables: { key: string; columns: string[] }[] } }>(layout, {
      input: { key: 'tasks', columns: ['status', 'title'], hidden: [], widths: [] },
    });
    expect(saveTableLayout.tables).toEqual([{ key: 'tasks', columns: ['status', 'title'], hidden: [], widths: [], pageSize: null }]);

    const save = `mutation($input: SaveViewInput!) { saveView(input: $input) { savedViews { id name resource where pinned filter { and { field op value values } } } } }`;
    const { saveView } = await user.data<{ saveView: { savedViews: { id: string; name: string }[] } }>(save, {
      input: { name: 'My urgent work', resource: 'tasks', where: 'assigneeId=@me', filter: { and: [{ field: 'priority', op: 'in', values: ['urgent', 'high'] }] }, pinned: true },
    });
    const [view] = saveView.savedViews;
    expect(view).toMatchObject({ name: 'My urgent work', pinned: true });
    await user.data(save, { input: { id: view!.id, name: 'Renamed', resource: 'tasks', pinned: false } });
    const { myPreferences } = await user.data<{ myPreferences: { savedViews: { name: string }[] } }>('{ myPreferences { savedViews { name } } }');
    expect(myPreferences.savedViews.map((saved) => saved.name)).toEqual(['Renamed']);

    expect((await user.error(save, { input: { name: 'Nope', resource: 'planets', pinned: false } })).message).toMatch(/Unknown resource/);
    const { deleteView } = await user.data<{ deleteView: { savedViews: unknown[] } }>('mutation($id: ID!) { deleteView(viewId: $id) { savedViews { id } } }', { id: view!.id });
    expect(deleteView.savedViews).toEqual([]);
  });

  it('keeps tabs inside the app', async () => {
    const user = await TestUser.signUp('Prefs tabs');
    const setTabs = 'mutation($tabs: [WorkspaceTabInput!]!) { setTabs(input: { tabs: $tabs }) { tabs { id path title pinned } } }';
    const { setTabs: saved } = await user.data<{ setTabs: { tabs: { path: string }[] } }>(setTabs, {
      tabs: [
        { id: 'home', path: '/w/abc', title: 'Home', pinned: true },
        { id: 'list', path: '/w/abc/l/def?task=1', title: 'Roadmap', pinned: false },
      ],
    });
    expect(saved.tabs.map((tab) => tab.path)).toEqual(['/w/abc', '/w/abc/l/def?task=1']);
    for (const path of ['//evil.example', 'https://evil.example', 'javascript:alert(1)']) {
      expect((await user.error(setTabs, { tabs: [{ id: 'x', path, title: 'x', pinned: false }] })).code).toBe('BAD_USER_INPUT');
    }
    expect((await user.error(setTabs, { tabs: [{ id: 'bad id!', path: '/w', title: 'x', pinned: false }] })).code).toBe('BAD_USER_INPUT');
  });

  it('needs a session', async () => {
    expect((await new TestUser('Anonymous').error('{ myPreferences { theme } }')).code).toBe('UNAUTHENTICATED');
  });
});
