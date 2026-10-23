import type { Department, DepartmentWithCount, NewDepartment } from './department.js';

export abstract class DepartmentRepository {
  /** Ordered by name. */
  abstract listWithCounts(workspaceId: string): Promise<DepartmentWithCount[]>;
  abstract findInWorkspace(workspaceId: string, departmentId: string): Promise<Department | null>;
  abstract create(department: NewDepartment): Promise<Department>;
  abstract save(department: Department): Promise<Department>;
  /** Profiles in the department are left without one (ON DELETE SET NULL). */
  abstract delete(workspaceId: string, departmentId: string): Promise<void>;
}
