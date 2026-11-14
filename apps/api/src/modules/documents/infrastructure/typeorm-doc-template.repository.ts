import { Injectable } from '@nestjs/common';
import type { IconKey } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DocTemplateRepository, type DocTemplate } from '../domain/doc-template.repository.js';

interface Row {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  icon: IconKey | null;
  content: string;
  created_by_id: string | null;
  created_at: Date;
}

const COLUMNS = 'id, workspace_id, name, description, icon, content, created_by_id, created_at';
const toTemplate = (row: Row): DocTemplate => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  description: row.description,
  icon: row.icon,
  content: row.content,
  createdById: row.created_by_id,
  createdAt: new Date(row.created_at),
});

/** Bound parameters only. */
@Injectable()
export class TypeOrmDocTemplateRepository extends DocTemplateRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query(sql: string, params: unknown[]): Promise<Row[]> {
    return this.transactional.manager.query(sql, params);
  }

  async list(workspaceId: string, limit: number): Promise<DocTemplate[]> {
    return (await this.query(`SELECT ${COLUMNS} FROM doc_template WHERE workspace_id = $1 ORDER BY lower(name), id LIMIT $2`, [workspaceId, limit])).map(toTemplate);
  }

  async count(workspaceId: string): Promise<number> {
    const rows = (await this.query(`SELECT count(*)::int AS n FROM doc_template WHERE workspace_id = $1`, [workspaceId])) as unknown as { n: number }[];
    return Number(rows[0]?.n ?? 0);
  }

  async find(workspaceId: string, id: string): Promise<DocTemplate | null> {
    const [row] = await this.query(`SELECT ${COLUMNS} FROM doc_template WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
    return row ? toTemplate(row) : null;
  }

  async create(template: Omit<DocTemplate, 'id' | 'createdAt'>): Promise<DocTemplate> {
    const [row] = await this.query(
      `INSERT INTO doc_template (workspace_id, name, description, icon, content, created_by_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
      [template.workspaceId, template.name, template.description, template.icon, template.content, template.createdById],
    );
    return toTemplate(row!);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await this.query(`DELETE FROM doc_template WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  }
}
