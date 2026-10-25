import type { CustomFieldEntity, CustomFieldOption, CustomFieldType } from '@taskflow/shared-types';

export interface CustomField {
  id: string;
  workspaceId: string;
  /** Null: applies in every space. */
  spaceId: string | null;
  entity: CustomFieldEntity;
  name: string;
  type: CustomFieldType;
  options: CustomFieldOption[];
  required: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NewCustomField = Omit<CustomField, 'id' | 'createdAt' | 'updatedAt'>;

/** Whether a field can hold a value on this entity in this space. */
export function appliesTo(field: CustomField, entity: CustomFieldEntity, spaceId: string | null): boolean {
  return field.entity === entity && (field.spaceId === null || field.spaceId === spaceId);
}
