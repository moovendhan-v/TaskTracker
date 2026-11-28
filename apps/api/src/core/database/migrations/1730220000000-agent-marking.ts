import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E6.5: changes and comments made by an AI agent through MCP carry the agent's name (the MCP
 * connection), so task history and threads tell them apart from a person's. Null means a person.
 */
export class AgentMarking1730220000000 implements MigrationInterface {
  name = 'AgentMarking1730220000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE task_activity ADD COLUMN agent varchar(80)`);
    await queryRunner.query(`ALTER TABLE task_comment ADD COLUMN agent varchar(80)`);
    // AI agent tokens (MCP / UTCP) are scoped read, or read and write, across the GraphQL API.
    await queryRunner.query(`ALTER TABLE api_token DROP CONSTRAINT api_token_scopes_check`);
    await queryRunner.query(
      `ALTER TABLE api_token ADD CONSTRAINT api_token_scopes_check CHECK (cardinality(scopes) BETWEEN 1 AND 8 AND scopes <@ ARRAY['bugs:read', 'bugs:write', 'tasks:read', 'tasks:write', 'read', 'write']::text[])`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM api_token WHERE scopes && ARRAY['read', 'write']::text[]`);
    await queryRunner.query(`ALTER TABLE api_token DROP CONSTRAINT api_token_scopes_check`);
    await queryRunner.query(`ALTER TABLE api_token ADD CONSTRAINT api_token_scopes_check CHECK (cardinality(scopes) BETWEEN 1 AND 8 AND scopes <@ ARRAY['bugs:read', 'bugs:write', 'tasks:read', 'tasks:write']::text[])`);
    await queryRunner.query(`ALTER TABLE task_comment DROP COLUMN agent`);
    await queryRunner.query(`ALTER TABLE task_activity DROP COLUMN agent`);
  }
}
