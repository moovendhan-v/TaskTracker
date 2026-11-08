import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A4 / E3: a workspace can require two-step sign-in for its admins or for everyone.
 * Members without it keep their membership; the access layer holds back the
 * permissions the requirement covers (see permissionsWithoutTwoStep).
 */
export class TwoStepRequirement1729970000000 implements MigrationInterface {
  name = 'TwoStepRequirement1729970000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE workspace ADD COLUMN two_step_required text NOT NULL DEFAULT 'off'`);
    await queryRunner.query(`ALTER TABLE workspace ADD CONSTRAINT chk_workspace_two_step_required CHECK (two_step_required IN ('off', 'admins', 'everyone'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE workspace DROP COLUMN two_step_required`);
  }
}
