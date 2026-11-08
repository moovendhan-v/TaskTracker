import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C5: live page editing. The shared Yjs document is stored next to the markdown, so a
 * room reopened later continues the same history and browsers that were offline merge
 * their edits instead of duplicating the page. `live_lineage` names that history; when
 * the markdown changes outside live editing, a new lineage starts.
 */
export class LiveDocs1729980000000 implements MigrationInterface {
  name = 'LiveDocs1729980000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE document ADD COLUMN live_state bytea`);
    await queryRunner.query(`ALTER TABLE document ADD COLUMN live_lineage uuid`);
    // A page's live history is bounded; beyond this a new lineage starts from the markdown.
    await queryRunner.query(`ALTER TABLE document ADD CONSTRAINT chk_document_live_state_size CHECK (live_state IS NULL OR octet_length(live_state) <= 4194304)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE document DROP COLUMN live_lineage`);
    await queryRunner.query(`ALTER TABLE document DROP COLUMN live_state`);
  }
}
