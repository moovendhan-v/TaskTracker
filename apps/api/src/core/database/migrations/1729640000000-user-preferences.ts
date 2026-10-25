import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Personal settings per user (theme, layout, saved views, tabs). Only the user can read or write their row. */
export class UserPreferences1729640000000 implements MigrationInterface {
  name = 'UserPreferences1729640000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_preference (
        user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_user_preference_object CHECK (jsonb_typeof(data) = 'object'),
        CONSTRAINT chk_user_preference_size CHECK (pg_column_size(data) < 262144)
      )`);
    await queryRunner.query(`ALTER TABLE user_preference ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE user_preference FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY own_preferences ON user_preference
      USING (user_id = app_current_user_id())
      WITH CHECK (user_id = app_current_user_id())`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE user_preference`);
  }
}
