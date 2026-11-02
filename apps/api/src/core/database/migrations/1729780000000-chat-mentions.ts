import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Chat @mentions land in the inbox as a new notification kind. */
export class ChatMentions1729780000000 implements MigrationInterface {
  name = 'ChatMentions1729780000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await queryRunner.query(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM notification WHERE kind = 'chat_mention'`);
    await queryRunner.query(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await queryRunner.query(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation'))`);
  }
}
