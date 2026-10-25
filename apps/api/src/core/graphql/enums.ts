import { registerEnumType } from '@nestjs/graphql';
import {
  EMPLOYMENT_TYPES,
  FIELD_TYPES,
  FILTER_OPERATORS,
  LOGIC_OPERATORS,
  LEAVE_DECISIONS,
  LEAVE_STATUSES,
  NOTIFICATION_KINDS,
  PLATFORM_ROLES,
  REALTIME_ENTITY_TYPES,
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
export const NotificationKindEnum = enumOf(NOTIFICATION_KINDS);
export const RealtimeEntityTypeEnum = enumOf(REALTIME_ENTITY_TYPES);
export const FilterOperatorEnum = enumOf(FILTER_OPERATORS);
export const FieldTypeEnum = enumOf(FIELD_TYPES);
export const LogicOperatorEnum = enumOf(LOGIC_OPERATORS);
export const SortDirectionEnum = enumOf(['asc', 'desc'] as const);

registerEnumType(TaskStatusEnum, { name: 'TaskStatus' });
registerEnumType(TaskPriorityEnum, { name: 'TaskPriority' });
registerEnumType(SprintStatusEnum, { name: 'SprintStatus' });
registerEnumType(LeaveStatusEnum, { name: 'LeaveStatus' });
registerEnumType(LeaveDecisionEnum, { name: 'LeaveDecision' });
registerEnumType(EmploymentTypeEnum, { name: 'EmploymentType' });
registerEnumType(PlatformRoleEnum, { name: 'PlatformRole' });
registerEnumType(NotificationKindEnum, { name: 'NotificationKind' });
registerEnumType(RealtimeEntityTypeEnum, { name: 'RealtimeEntityType' });
registerEnumType(FilterOperatorEnum, { name: 'FilterOperator' });
registerEnumType(FieldTypeEnum, { name: 'FieldType' });
registerEnumType(LogicOperatorEnum, { name: 'LogicOperator' });
registerEnumType(SortDirectionEnum, { name: 'SortDirection' });
