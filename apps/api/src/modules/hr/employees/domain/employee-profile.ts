import type { EmploymentType } from '@taskflow/shared-types';

export interface EmployeeProfile {
  workspaceId: string;
  userId: string;
  jobTitle: string | null;
  departmentId: string | null;
  managerUserId: string | null;
  employmentType: EmploymentType | null;
  /** yyyy-mm-dd */
  startDate: string | null;
  updatedAt: Date;
}

export type ProfileFields = Pick<EmployeeProfile, 'jobTitle' | 'departmentId' | 'managerUserId' | 'employmentType' | 'startDate'>;

/** A current member joined with their (possibly empty) profile. */
export interface DirectoryEntry extends ProfileFields {
  userId: string;
  name: string;
  email: string;
  departmentName: string | null;
}
