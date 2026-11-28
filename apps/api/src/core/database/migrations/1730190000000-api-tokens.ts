import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E6.3 personal API tokens, first for the browser extension. A token belongs to one person in one
 * workspace, carries scopes (bugs:read, bugs:write), expires, and can be revoked. Only a SHA-256
 * hash of it is stored.
 *
 * Connecting works like a device sign-in with PKCE: the extension keeps a random verifier and
 * opens TaskFlow with its hash (the challenge); the signed-in person approves, which stores a
 * pending row with that challenge; the extension then swaps the verifier for the token, once,
 * within ten minutes. The link alone (with only the challenge) can't get a token.
 *
 * Rows are the owner's own: tenant isolation plus a restrictive owner policy. Looking a token up
 * by its hash before anyone is known runs in the platform scope, inside the token service only.
 */
export class ApiTokens1730190000000 implements MigrationInterface {
  name = 'ApiTokens1730190000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE api_token (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        client varchar(20) NOT NULL DEFAULT 'extension' CHECK (client IN ('extension', 'mcp', 'script')),
        scopes text[] NOT NULL CHECK (cardinality(scopes) BETWEEN 1 AND 8 AND scopes <@ ARRAY['bugs:read', 'bugs:write', 'tasks:read', 'tasks:write']::text[]),
        token_hash char(64) UNIQUE,
        token_prefix varchar(16),
        challenge_hash char(64) UNIQUE,
        challenge_expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        last_used_at timestamptz,
        revoked_at timestamptz,
        -- Either waiting to be picked up (challenge) or issued (token), never both.
        CHECK ((token_hash IS NULL) <> (challenge_hash IS NULL)),
        CHECK (challenge_hash IS NULL OR challenge_expires_at IS NOT NULL)
      )`);
    await q(`CREATE INDEX api_token_owner_idx ON api_token (workspace_id, user_id, created_at DESC)`);
    await q(`ALTER TABLE api_token ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE api_token FORCE ROW LEVEL SECURITY`);
    await q(`CREATE POLICY tenant_isolation ON api_token USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    await q(`CREATE POLICY owner_only ON api_token AS RESTRICTIVE USING (app_is_platform_scope() OR user_id = app_current_user_id()) WITH CHECK (app_is_platform_scope() OR user_id = app_current_user_id())`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE api_token`);
  }
}
