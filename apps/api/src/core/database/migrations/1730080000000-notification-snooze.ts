import type { MigrationInterface, QueryRunner } from 'typeorm';

/** C6: snoozing an inbox item hides it until a time, when it comes back unread. */
export class NotificationSnooze1730080000000 implements MigrationInterface {
  name = 'NotificationSnooze1730080000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification ADD COLUMN snoozed_until timestamptz`);
    await queryRunner.query(`CREATE INDEX idx_notification_snoozed ON notification (workspace_id, recipient_id, snoozed_until) WHERE snoozed_until IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification DROP COLUMN snoozed_until`);
  }
}
