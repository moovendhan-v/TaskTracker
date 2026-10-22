export interface Department {
  id: string;
  workspaceId: string;
  name: string;
  headUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewDepartment = Pick<Department, 'workspaceId' | 'name' | 'headUserId'>;

export interface DepartmentWithCount extends Department {
  /** Current workspace members whose profile is in this department. */
  memberCount: number;
}
