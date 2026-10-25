import type { CustomFieldEntity, CustomFieldOption, CustomFieldType } from '../domain/custom-field.js';

export interface CustomFieldResponse {
  id: string;
  /** Null for workspace-wide fields. */
  spaceId: string | null;
  entity: CustomFieldEntity;
  name: string;
  type: CustomFieldType;
  options: CustomFieldOption[];
  required: boolean;
  position: number;
}

export interface SaveCustomFieldRequest {
  name: string;
  type: CustomFieldType;
  entity?: CustomFieldEntity;
  spaceId?: string | null;
  options?: CustomFieldOption[];
  required?: boolean;
}
