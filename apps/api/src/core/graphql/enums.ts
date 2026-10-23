import { registerEnumType } from '@nestjs/graphql';
import {
  EMPLOYMENT_TYPES,
  LEAVE_DECISIONS,
  LEAVE_STATUSES,
  PLATFORM_ROLES,
  SPRINT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@taskflow/shared-types';

/** Turns a shared `as const` list into the object form GraphQL enums need. */
function enumOf<const T extends readonly string[]>(values: T): { [K in T[number]]: K } {
  return Object.fromEntries(values.map((value) => [value, value])) as { [K in T[number]]: K };
}

export const TaskStatusEnum = enumOf(TASK_STATUSES);
export const TaskPriorityEnum = enumOf(TASK_PRIORITIES);
export const SprintStatusEnum = enumOf(SPRINT_STATUSES);
export const LeaveStatusEnum = enumOf(LEAVE_STATUSES);
export const LeaveDecisionEnum = enumOf(LEAVE_DECISIONS);
export const EmploymentTypeEnum = enumOf(EMPLOYMENT_TYPES);
export const PlatformRoleEnum = enumOf(PLATFORM_ROLES);

registerEnumType(TaskStatusEnum, { name: 'TaskStatus' });
registerEnumType(TaskPriorityEnum, { name: 'TaskPriority' });
registerEnumType(SprintStatusEnum, { name: 'SprintStatus' });
registerEnumType(LeaveStatusEnum, { name: 'LeaveStatus' });
registerEnumType(LeaveDecisionEnum, { name: 'LeaveDecision' });
registerEnumType(EmploymentTypeEnum, { name: 'EmploymentType' });
registerEnumType(PlatformRoleEnum, { name: 'PlatformRole' });
