import { Injectable } from '@nestjs/common';
import type { EmploymentType } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import type { DirectoryEntry, EmployeeProfile, ProfileFields } from '../domain/employee-profile.js';
import { EmployeeProfileRepository } from '../domain/employee-profile.repository.js';
import { EmployeeProfileOrmEntity } from './employee-profile.orm-entity.js';

interface DirectoryRow {
  user_id: string;
  name: string;
  email: string;
  job_title: string | null;
  department_id: string | null;
  department_name: string | null;
  manager_user_id: string | null;
  employment_type: EmploymentType | null;
  start_date: string | null;
}

/** Members are the source of truth for who's in the directory; profiles add HR details. */
const DIRECTORY_SQL = `
  SELECT member.user_id, account.name, account.email,
         profile.job_title, profile.department_id, department.name AS department_name,
         profile.manager_user_id, profile.employment_type, to_char(profile.start_date, 'YYYY-MM-DD') AS start_date
  FROM workspace_member member
  JOIN "user" account ON account.id = member.user_id
  LEFT JOIN employee_profile profile ON profile.workspace_id = member.workspace_id AND profile.user_id = member.user_id
  LEFT JOIN department ON department.id = profile.department_id
  WHERE member.workspace_id = $1`;

const CHAIN_GUARD = 50;

@Injectable()
export class TypeOrmEmployeeProfileRepository extends EmployeeProfileRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async directory(workspaceId: string, limit: number): Promise<DirectoryEntry[]> {
    const rows: DirectoryRow[] = await this.transactional.manager.query(`${DIRECTORY_SQL} ORDER BY account.name LIMIT $2`, [
      workspaceId,
      limit,
    ]);
    return rows.map(toEntry);
  }

  async findEntry(workspaceId: string, userId: string): Promise<DirectoryEntry | null> {
    const rows: DirectoryRow[] = await this.transactional.manager.query(`${DIRECTORY_SQL} AND member.user_id = $2`, [
      workspaceId,
      userId,
    ]);
    return rows[0] ? toEntry(rows[0]) : null;
  }

  findProfile(workspaceId: string, userId: string): Promise<EmployeeProfile | null> {
    return this.transactional.repository(EmployeeProfileOrmEntity).findOneBy({ workspaceId, userId });
  }

  async managerChain(workspaceId: string, userId: string): Promise<string[]> {
    const rows: { manager_user_id: string }[] = await this.transactional.manager.query(
      `WITH RECURSIVE chain AS (
         SELECT manager_user_id, 1 AS depth FROM employee_profile WHERE workspace_id = $1 AND user_id = $2
         UNION ALL
         SELECT profile.manager_user_id, chain.depth + 1
         FROM employee_profile profile JOIN chain ON profile.user_id = chain.manager_user_id
         WHERE profile.workspace_id = $1 AND chain.depth < $3
       )
       SELECT manager_user_id FROM chain WHERE manager_user_id IS NOT NULL ORDER BY depth`,
      [workspaceId, userId, CHAIN_GUARD],
    );
    return rows.map((row) => row.manager_user_id);
  }

  async upsert(workspaceId: string, userId: string, fields: ProfileFields): Promise<void> {
    await this.transactional.repository(EmployeeProfileOrmEntity).upsert({ workspaceId, userId, ...fields }, ['workspaceId', 'userId']);
  }
}

function toEntry(row: DirectoryRow): DirectoryEntry {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    managerUserId: row.manager_user_id,
    employmentType: row.employment_type,
    startDate: row.start_date,
  };
}
