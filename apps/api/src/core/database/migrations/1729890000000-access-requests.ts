import type { MigrationInterface, QueryRunner } from 'typeorm';

/** E3: people can ask for access they don't have; role managers get a notification. */
export class AccessRequests1729890000000 implements MigrationInterface {
  name = 'AccessRequests1729890000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await queryRunner.query(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention', 'access_requested'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM notification WHERE kind = 'access_requested'`);
    await queryRunner.query(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await queryRunner.query(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention'))`);
  }
}
