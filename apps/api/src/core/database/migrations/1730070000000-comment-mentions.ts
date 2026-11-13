import type { MigrationInterface, QueryRunner } from 'typeorm';

/** C6: being @mentioned in a task comment is its own inbox kind. */
export class CommentMentions1730070000000 implements MigrationInterface {
  name = 'CommentMentions1730070000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await queryRunner.query(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention', 'access_requested', 'access_decided', 'comment_mention'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM notification WHERE kind = 'comment_mention'`);
    await queryRunner.query(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await queryRunner.query(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention', 'access_requested', 'access_decided'))`);
  }
}
