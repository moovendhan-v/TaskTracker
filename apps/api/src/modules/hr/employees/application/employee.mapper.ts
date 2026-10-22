import type { EmployeeResponse } from '@taskflow/shared-types';
import type { DirectoryEntry } from '../domain/employee-profile.js';

export const EmployeeMapper = {
  toResponse(entry: DirectoryEntry): EmployeeResponse {
    return {
      userId: entry.userId,
      name: entry.name,
      email: entry.email,
      jobTitle: entry.jobTitle,
      departmentId: entry.departmentId,
      departmentName: entry.departmentName,
      managerUserId: entry.managerUserId,
      employmentType: entry.employmentType,
      startDate: entry.startDate,
    };
  },
};
