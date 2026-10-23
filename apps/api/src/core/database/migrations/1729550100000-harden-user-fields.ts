import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Better Auth adds platformRole and suspended as nullable columns with no
 * database default. Make them NOT NULL with safe defaults so a row can never
 * end up with an unknown role.
 */
export class HardenUserFields1729550100000 implements MigrationInterface {
  name = 'HardenUserFields1729550100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "user" SET "platformRole" = 'USER' WHERE "platformRole" IS NULL`);
    await queryRunner.query(`UPDATE "user" SET "suspended" = false WHERE "suspended" IS NULL`);
    await queryRunner.query(`
      ALTER TABLE "user"
        ALTER COLUMN "platformRole" SET DEFAULT 'USER',
        ALTER COLUMN "platformRole" SET NOT NULL,
        ALTER COLUMN "suspended" SET DEFAULT false,
        ALTER COLUMN "suspended" SET NOT NULL,
        ADD CONSTRAINT chk_user_platform_role CHECK ("platformRole" IN ('SUPER_ADMIN', 'USER'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
        DROP CONSTRAINT IF EXISTS chk_user_platform_role,
        ALTER COLUMN "platformRole" DROP NOT NULL,
        ALTER COLUMN "platformRole" DROP DEFAULT,
        ALTER COLUMN "suspended" DROP NOT NULL,
        ALTER COLUMN "suspended" DROP DEFAULT`);
  }
}
