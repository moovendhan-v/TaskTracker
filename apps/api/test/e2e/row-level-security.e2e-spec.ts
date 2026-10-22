import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runtimeDatabase, withScope } from './support/database.js';
import { createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

/**
 * Checks the database itself, as the API's runtime role: even a query with no
 * workspace filter can't reach another tenant's rows.
 */
describe('Postgres row-level security', () => {
  const db = runtimeDatabase();
  let a: WorkspaceFixture;
  let b: WorkspaceFixture;

  beforeAll(async () => {
    a = await createWorkspace('RLS A');
    b = await createWorkspace('RLS B');
    for (const ws of [a, b]) {
      await ws.owner.data('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Private" }) { id } }', {
        w: ws.workspaceId,
        l: ws.listId,
      });
    }
  });

  afterAll(() => db.end());

  it('runs the API as a role that cannot bypass row-level security', async () => {
    const { rows } = await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('forces RLS on every table that holds workspace data', async () => {
    const { rows } = await db.query<{ relname: string }>(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind = 'r'
        AND (c.relname = 'workspace' OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'workspace_id'))
        AND NOT (c.relrowsecurity AND c.relforcerowsecurity)`);
    expect(rows).toEqual([]);
  });

  it('shows no tenant rows without a scope (fails closed)', async () => {
    const { rows } = await db.query('SELECT id FROM task UNION ALL SELECT id FROM workspace');
    expect(rows).toEqual([]);
  });

  it("limits an unfiltered query to the scoped workspace's rows", async () => {
    const workspaces = await withScope(db, { workspaceId: a.workspaceId }, async (client) => {
      const { rows } = await client.query<{ workspace_id: string }>('SELECT DISTINCT workspace_id FROM task');
      return rows.map((row) => row.workspace_id);
    });
    expect(workspaces).toEqual([a.workspaceId]);
  });

  it("rejects writing a row into another workspace", async () => {
    await expect(
      withScope(db, { workspaceId: a.workspaceId }, (client) =>
        client.query('INSERT INTO space (workspace_id, name, color) VALUES ($1, $2, $3)', [b.workspaceId, 'Smuggled', '#000000']),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("can't update or delete another workspace's rows", async () => {
    const counts = await withScope(db, { workspaceId: a.workspaceId }, async (client) => {
      const updated = await client.query("UPDATE task SET title = 'hacked' WHERE workspace_id = $1", [b.workspaceId]);
      const deleted = await client.query('DELETE FROM space WHERE workspace_id = $1', [b.workspaceId]);
      return [updated.rowCount, deleted.rowCount];
    });
    expect(counts).toEqual([0, 0]);
  });

  it("outside a workspace, users see only their own memberships", async () => {
    const visible = await withScope(db, { userId: a.owner.id }, async (client) => {
      const members = await client.query<{ workspace_id: string }>('SELECT workspace_id FROM workspace_member');
      const workspaces = await client.query<{ id: string }>('SELECT id FROM workspace');
      const tasks = await client.query('SELECT id FROM task');
      return { members: members.rows.map((row) => row.workspace_id), workspaces: workspaces.rows.map((row) => row.id), tasks: tasks.rowCount };
    });
    expect(visible).toEqual({ members: [a.workspaceId], workspaces: [a.workspaceId], tasks: 0 });
  });

  it('gives the platform scope every row', async () => {
    const count = await withScope(db, { platform: true }, async (client) => {
      const { rows } = await client.query<{ count: string }>('SELECT count(DISTINCT workspace_id) AS count FROM task WHERE workspace_id = ANY($1)', [
        [a.workspaceId, b.workspaceId],
      ]);
      return Number(rows[0]?.count);
    });
    expect(count).toBe(2);
  });
});
