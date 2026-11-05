import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D1: chat retention. A workspace can keep chat for a set number of days; a
 * scheduled sweep removes threads whose last message is older. Messages could
 * not be deleted at all before (no DELETE policy); now only the platform scope,
 * which the sweep runs in, can delete them. People still "delete" their own
 * messages the soft way.
 */
export class ChatRetention1729940000000 implements MigrationInterface {
  name = 'ChatRetention1729940000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE workspace ADD COLUMN chat_retention_days integer`);
    await q(`ALTER TABLE workspace ADD CONSTRAINT chk_workspace_chat_retention CHECK (chat_retention_days IS NULL OR chat_retention_days IN (30, 90, 180, 365, 730))`);
    await q(`CREATE POLICY chat_message_delete ON chat_message FOR DELETE USING (app_is_platform_scope())`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS chat_message_delete ON chat_message`);
    await queryRunner.query(`ALTER TABLE workspace DROP COLUMN chat_retention_days`);
  }
}
