import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E2 GitHub App sync of labels and assignee. Each linked issue remembers what
 * sync last agreed on, like its title: the label option ids of the connection's
 * labels field, and the TaskFlow assignee. github_issue's existing RLS covers it.
 */
export class GithubIssueLabelsAssignee1730140000000 implements MigrationInterface {
  name = 'GithubIssueLabelsAssignee1730140000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE github_issue
        ADD COLUMN synced_labels jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT chk_github_issue_synced_labels CHECK (jsonb_typeof(synced_labels) = 'array'),
        ADD COLUMN synced_assignee_id text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE github_issue DROP COLUMN synced_labels, DROP COLUMN synced_assignee_id`);
  }
}
