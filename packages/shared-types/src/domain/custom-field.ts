/** Fields a workspace adds to tasks or spaces (projects), like "Client name" or "Story points". */
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'money', 'date', 'checkbox', 'select', 'multi_select', 'url', 'email', 'user'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_ENTITIES = ['task', 'space'] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export interface CustomFieldOption {
  id: string;
  label: string;
  color?: string | null;
}

export const CUSTOM_FIELD_LIMITS = { nameMax: 60, perWorkspace: 100, optionsMax: 50, textMax: 2000 } as const;

/** Project health shown on space dashboards. */
export const SPACE_STATUSES = ['on_track', 'at_risk', 'off_track', 'on_hold', 'complete'] as const;
export type SpaceStatus = (typeof SPACE_STATUSES)[number];
