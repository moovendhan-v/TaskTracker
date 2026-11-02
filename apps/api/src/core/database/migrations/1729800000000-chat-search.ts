import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Full-text search over chat messages. The 'simple' configuration (no stemming
 * or stop words) suits short, mixed-language chat. Row-level security still
 * decides which messages a search can return.
 */
export class ChatSearch1729800000000 implements MigrationInterface {
  name = 'ChatSearch1729800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_message ADD COLUMN search tsvector GENERATED ALWAYS AS (to_tsvector('simple', body)) STORED`);
    await queryRunner.query(`CREATE INDEX idx_chat_message_search ON chat_message USING gin (search)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chat_message_search`);
    await queryRunner.query(`ALTER TABLE chat_message DROP COLUMN IF EXISTS search`);
  }
}
