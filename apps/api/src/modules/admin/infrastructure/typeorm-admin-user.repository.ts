import { Injectable } from '@nestjs/common';
import type { PlatformRole } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { PageRequest } from '../../../core/domain/page-request.js';
import { escapeLike } from '../../../core/http/utils/escape-like.js';
import type { AdminUser } from '../domain/admin-user.js';
import { AdminUserRepository } from '../domain/admin-user.repository.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole;
  suspended: boolean;
  workspace_count: string;
  createdAt: Date;
}

const SELECT_USERS = `
  SELECT u.id, u.name, u.email, u."platformRole", u.suspended, u."createdAt",
         (SELECT COUNT(*) FROM workspace_member m WHERE m.user_id = u.id) AS workspace_count
  FROM "user" u`;

/** Reads and updates Better Auth's user table with bound parameters only. */
@Injectable()
export class TypeOrmAdminUserRepository extends AdminUserRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async page(search: string | undefined, page: PageRequest): Promise<{ items: AdminUser[]; total: number }> {
    const where = search ? `WHERE u.name ILIKE $1 OR u.email ILIKE $1` : '';
    const params = search ? [`%${escapeLike(search)}%`] : [];
    const offset = (page.page - 1) * page.pageSize;
    const [rows, count] = await Promise.all([
      this.transactional.manager.query(
        `${SELECT_USERS} ${where} ORDER BY u."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, page.pageSize, offset],
      ) as Promise<UserRow[]>,
      this.transactional.manager.query(`SELECT COUNT(*) AS total FROM "user" u ${where}`, params) as Promise<{ total: string }[]>,
    ]);
    return { items: rows.map(toUser), total: Number(count[0]?.total ?? 0) };
  }

  async findById(userId: string): Promise<AdminUser | null> {
    const rows: UserRow[] = await this.transactional.manager.query(`${SELECT_USERS} WHERE u.id = $1`, [userId]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async countActiveSuperAdminsForUpdate(): Promise<number> {
    const rows: { id: string }[] = await this.transactional.manager.query(
      `SELECT id FROM "user" WHERE "platformRole" = 'SUPER_ADMIN' AND suspended = false FOR UPDATE`,
    );
    return rows.length;
  }

  async update(userId: string, changes: { suspended?: boolean; platformRole?: PlatformRole }): Promise<void> {
    if (changes.suspended !== undefined) {
      await this.transactional.manager.query(`UPDATE "user" SET suspended = $2, "updatedAt" = now() WHERE id = $1`, [userId, changes.suspended]);
    }
    if (changes.platformRole !== undefined) {
      await this.transactional.manager.query(`UPDATE "user" SET "platformRole" = $2, "updatedAt" = now() WHERE id = $1`, [
        userId,
        changes.platformRole,
      ]);
    }
  }

  async revokeSessions(userId: string): Promise<void> {
    await this.transactional.manager.query(`DELETE FROM "session" WHERE "userId" = $1`, [userId]);
  }
}

function toUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    platformRole: row.platformRole,
    suspended: row.suspended,
    workspaceCount: Number(row.workspace_count),
    createdAt: new Date(row.createdAt),
  };
}
