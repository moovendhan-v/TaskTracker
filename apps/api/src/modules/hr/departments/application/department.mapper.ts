import type { DepartmentResponse } from '@taskflow/shared-types';
import type { DepartmentWithCount } from '../domain/department.js';

export const DepartmentMapper = {
  toResponse(department: DepartmentWithCount): DepartmentResponse {
    return {
      id: department.id,
      name: department.name,
      headUserId: department.headUserId,
      memberCount: department.memberCount,
    };
  },
};
