import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { PageRequest } from '../../../core/domain/page-request.js';
import { escapeLike } from '../../../core/http/utils/escape-like.js';
import type { AdminWorkspace } from '../domain/admin-user.js';
import { AdminWorkspaceRepository } from '../domain/admin-workspace.repository.js';

interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string | null;
  member_count: string;
  created_at: Date;
}

@Injectable()
export class TypeOrmAdminWorkspaceRepository extends AdminWorkspaceRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async page(search: string | undefined, page: PageRequest): Promise<{ items: AdminWorkspace[]; total: number }> {
    const where = search ? `WHERE w.name ILIKE $1` : '';
    const params = search ? [`%${escapeLike(search)}%`] : [];
    const offset = (page.page - 1) * page.pageSize;
    // Sequential on purpose: an operation's queries share one transaction connection, which runs one query at a time.
    const rows: WorkspaceRow[] = await this.transactional.manager.query(
      `SELECT w.id, w.name, w.owner_id, owner.name AS owner_name, w.created_at,
              (SELECT COUNT(*) FROM workspace_member m WHERE m.workspace_id = w.id) AS member_count
       FROM workspace w LEFT JOIN "user" owner ON owner.id = w.owner_id
       ${where}
       ORDER BY w.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.pageSize, offset],
    );
    const count: { total: string }[] = await this.transactional.manager.query(`SELECT COUNT(*) AS total FROM workspace w ${where}`, params);
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        ownerName: row.owner_name ?? 'Former user',
        memberCount: Number(row.member_count),
        createdAt: new Date(row.created_at),
      })),
      total: Number(count[0]?.total ?? 0),
    };
  }
}
