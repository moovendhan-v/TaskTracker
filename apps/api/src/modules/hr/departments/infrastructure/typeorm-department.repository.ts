import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import type { Department, DepartmentWithCount, NewDepartment } from '../domain/department.js';
import { DepartmentRepository } from '../domain/department.repository.js';
import { DepartmentOrmEntity } from './department.orm-entity.js';

@Injectable()
export class TypeOrmDepartmentRepository extends DepartmentRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(DepartmentOrmEntity);
  }

  async listWithCounts(workspaceId: string): Promise<DepartmentWithCount[]> {
    const departments = await this.repository.find({ where: { workspaceId }, order: { name: 'ASC' } });
    if (departments.length === 0) return [];
    // Count only people who are still members, by table name so this module stays independent.
    const rows: { department_id: string; count: string }[] = await this.transactional.manager.query(
      `SELECT profile.department_id, COUNT(*) AS count
       FROM employee_profile profile
       JOIN workspace_member member ON member.workspace_id = profile.workspace_id AND member.user_id = profile.user_id
       WHERE profile.workspace_id = $1 AND profile.department_id IS NOT NULL
       GROUP BY profile.department_id`,
      [workspaceId],
    );
    const counts = new Map(rows.map((row) => [row.department_id, Number(row.count)]));
    return departments.map((department) => ({ ...department, memberCount: counts.get(department.id) ?? 0 }));
  }

  findInWorkspace(workspaceId: string, departmentId: string): Promise<Department | null> {
    return this.repository.findOneBy({ id: departmentId, workspaceId });
  }

  create(department: NewDepartment): Promise<Department> {
    return this.repository.save(this.repository.create(department));
  }

  save(department: Department): Promise<Department> {
    return this.repository.save(this.repository.create(department));
  }

  async delete(workspaceId: string, departmentId: string): Promise<void> {
    await this.repository.delete({ id: departmentId, workspaceId });
  }
}
