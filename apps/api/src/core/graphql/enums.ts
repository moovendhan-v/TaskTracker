import { registerEnumType } from '@nestjs/graphql';
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  DOC_KINDS,
  EMPLOYMENT_TYPES,
  FIELD_TYPES,
  FORECAST_KINDS,
  FILTER_OPERATORS,
  LOGIC_OPERATORS,
  LEAVE_DECISIONS,
  LEAVE_STATUSES,
  NOTIFICATION_KINDS,
  POLICY_EFFECTS,
  PLATFORM_ROLES,
  REALTIME_ENTITY_TYPES,
  SPACE_STATUSES,
  SPRINT_STATUSES,
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  TASK_RELATION_KINDS,
  TASK_TYPES,
} from '@taskflow/shared-types';

/** Turns a shared `as const` list into the object form GraphQL enums need. */
function enumOf<const T extends readonly string[]>(values: T): { [K in T[number]]: K } {
  return Object.fromEntries(values.map((value) => [value, value])) as { [K in T[number]]: K };
}

export const StatusCategoryEnum = enumOf(STATUS_CATEGORIES);
export const ForecastKindEnum = enumOf(FORECAST_KINDS);
export const TaskTypeEnum = enumOf(TASK_TYPES);
export const TaskRelationKindEnum = enumOf(TASK_RELATION_KINDS);
export const CustomFieldTypeEnum = enumOf(CUSTOM_FIELD_TYPES);
export const CustomFieldEntityEnum = enumOf(CUSTOM_FIELD_ENTITIES);
export const SpaceStatusEnum = enumOf(SPACE_STATUSES);
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
export const PolicyEffectEnum = enumOf(POLICY_EFFECTS);
export const DocKindEnum = enumOf(DOC_KINDS);

registerEnumType(StatusCategoryEnum, { name: 'StatusCategory' });
registerEnumType(DocKindEnum, { name: 'DocKind' });
registerEnumType(TaskTypeEnum, { name: 'TaskType' });
registerEnumType(TaskRelationKindEnum, { name: 'TaskRelationKind' });
registerEnumType(CustomFieldTypeEnum, { name: 'CustomFieldType' });
registerEnumType(CustomFieldEntityEnum, { name: 'CustomFieldEntity' });
registerEnumType(SpaceStatusEnum, { name: 'SpaceStatus' });
registerEnumType(ForecastKindEnum, { name: 'ForecastKind' });
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
registerEnumType(PolicyEffectEnum, { name: 'PolicyEffect' });
