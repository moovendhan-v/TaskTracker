import { Injectable } from '@nestjs/common';
import {
  isOrgRole,
  isTwoStepRequirement,
  type OrganizationActivityResponse,
  type OrganizationMemberResponse,
  type OrganizationWorkspaceResponse,
  type OrgRole,
  type TwoStepRequirement,
} from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { OrganizationRepository, type OrganizationRecord } from '../domain/organization.repository.js';

interface OrganizationRow {
  id: string;
  name: string;
  two_step_required: string;
  created_at: Date;
}

const toRecord = (row: OrganizationRow): OrganizationRecord => ({
  id: row.id,
  name: row.name,
  // An unknown value fails closed to the strictest rule.
  twoStepRequired: isTwoStepRequirement(row.two_step_required) ? row.two_step_required : 'everyone',
  createdAt: row.created_at,
});

/** Bound parameters only; row-level security limits every query to the current scope. */
@Injectable()
export class TypeOrmOrganizationRepository extends OrganizationRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.transactional.manager.query(sql, params);
  }

  async myRole(organizationId: string, userId: string): Promise<OrgRole | null> {
    const [row] = await this.query<{ role: string }>(`SELECT role FROM organization_member WHERE organization_id = $1 AND user_id = $2`, [organizationId, userId]);
    return isOrgRole(row?.role) ? row.role : null;
  }

  async listMine(userId: string): Promise<(OrganizationRecord & { role: OrgRole })[]> {
    const rows = await this.query<OrganizationRow & { role: string }>(
      `SELECT o.id, o.name, o.two_step_required, o.created_at, m.role
       FROM organization_member m JOIN organization o ON o.id = m.organization_id
       WHERE m.user_id = $1 ORDER BY lower(o.name) LIMIT 100`,
      [userId],
    );
    return rows.filter((row) => isOrgRole(row.role)).map((row) => ({ ...toRecord(row), role: row.role as OrgRole }));
  }

  async create(organization: { id: string; name: string; createdBy: string }): Promise<void> {
    await this.query(`INSERT INTO organization (id, name, created_by) VALUES ($1, $2, $3)`, [organization.id, organization.name, organization.createdBy]);
    await this.query(`INSERT INTO organization_member (organization_id, user_id, role) VALUES ($1, $2, 'owner')`, [organization.id, organization.createdBy]);
  }

  async find(organizationId: string): Promise<OrganizationRecord | null> {
    const [row] = await this.query<OrganizationRow>(`SELECT id, name, two_step_required, created_at FROM organization WHERE id = $1`, [organizationId]);
    return row ? toRecord(row) : null;
  }

  async rename(organizationId: string, name: string): Promise<void> {
    await this.query(`UPDATE organization SET name = $2 WHERE id = $1`, [organizationId, name]);
  }

  async setTwoStep(organizationId: string, requirement: TwoStepRequirement): Promise<void> {
    await this.query(`UPDATE organization SET two_step_required = $2 WHERE id = $1`, [organizationId, requirement]);
  }

  async delete(organizationId: string): Promise<void> {
    await this.query(`DELETE FROM organization WHERE id = $1`, [organizationId]);
  }

  async members(organizationId: string): Promise<OrganizationMemberResponse[]> {
    const rows = await this.query<{ user_id: string; name: string; email: string; role: string; strong: boolean; created_at: Date }>(
      `SELECT m.user_id, u.name, u.email, m.role, m.created_at,
              (u."twoFactorEnabled" IS TRUE OR EXISTS (SELECT 1 FROM passkey p WHERE p."userId" = u.id)) AS strong
       FROM organization_member m JOIN "user" u ON u.id = m.user_id
       WHERE m.organization_id = $1
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, lower(u.name) LIMIT 500`,
      [organizationId],
    );
    return rows
      .filter((row) => isOrgRole(row.role))
      .map((row) => ({ userId: row.user_id, name: row.name, email: row.email, role: row.role as OrgRole, hasTwoStep: row.strong === true, joinedAt: row.created_at.toISOString() }));
  }

  async addMember(organizationId: string, userId: string, role: OrgRole): Promise<boolean> {
    const rows = await this.query<{ user_id: string }>(
      `INSERT INTO organization_member (organization_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING user_id`,
      [organizationId, userId, role],
    );
    return rows.length > 0;
  }

  async setRole(organizationId: string, userId: string, role: OrgRole): Promise<void> {
    await this.query(`UPDATE organization_member SET role = $3 WHERE organization_id = $1 AND user_id = $2`, [organizationId, userId, role]);
  }

  async removeMember(organizationId: string, userId: string): Promise<void> {
    await this.query(`DELETE FROM organization_member WHERE organization_id = $1 AND user_id = $2`, [organizationId, userId]);
  }

  async ownerCount(organizationId: string): Promise<number> {
    const [row] = await this.query<{ count: string }>(`SELECT count(*) FROM organization_member WHERE organization_id = $1 AND role = 'owner'`, [organizationId]);
    return Number(row?.count ?? 0);
  }

  async workspaces(organizationId: string): Promise<OrganizationWorkspaceResponse[]> {
    return this.query<OrganizationWorkspaceResponse>(`SELECT id, name, color FROM workspace WHERE organization_id = $1 ORDER BY lower(name) LIMIT 500`, [organizationId]);
  }

  async activity(organizationId: string, limit: number): Promise<OrganizationActivityResponse[]> {
    const rows = await this.query<{ id: string; action: string; actor_name: string | null; target_type: string; metadata: Record<string, unknown> | null; created_at: Date }>(
      `SELECT a.id, a.action, u.name AS actor_name, a.target_type, a.metadata, a.created_at
       FROM audit_log a LEFT JOIN "user" u ON u.id = a.actor_id
       WHERE a.organization_id = $1 ORDER BY a.created_at DESC, a.id DESC LIMIT $2`,
      [organizationId, limit],
    );
    return rows.map((row) => ({ id: String(row.id), action: row.action, actorName: row.actor_name, targetType: row.target_type, metadata: row.metadata ?? {}, createdAt: row.created_at.toISOString() }));
  }

  async findUserByEmail(email: string): Promise<{ id: string; name: string; emailVerified: boolean } | null> {
    const [row] = await this.query<{ id: string; name: string; emailVerified: boolean }>(`SELECT id, name, "emailVerified" FROM "user" WHERE lower(email) = lower($1)`, [email]);
    return row ?? null;
  }

  async workspaceOrganization(workspaceId: string): Promise<{ id: string; name: string; twoStepRequired: TwoStepRequirement } | null> {
    const [row] = await this.query<OrganizationRow>(
      `SELECT o.id, o.name, o.two_step_required, o.created_at FROM workspace w JOIN organization o ON o.id = w.organization_id WHERE w.id = $1`,
      [workspaceId],
    );
    return row ? { id: row.id, name: row.name, twoStepRequired: toRecord(row).twoStepRequired } : null;
  }

  async setWorkspaceOrganization(workspaceId: string, organizationId: string | null): Promise<void> {
    await this.query(`UPDATE workspace SET organization_id = $2 WHERE id = $1`, [workspaceId, organizationId]);
  }
}
