import type { CustomFieldEntity } from '@taskflow/shared-types';
import type { CustomField, NewCustomField } from './custom-field.js';

export abstract class CustomFieldRepository {
  abstract list(workspaceId: string, entity?: CustomFieldEntity): Promise<CustomField[]>;
  abstract findInWorkspace(workspaceId: string, fieldId: string): Promise<CustomField | null>;
  abstract create(field: NewCustomField): Promise<CustomField>;
  abstract save(field: CustomField): Promise<CustomField>;
  abstract delete(workspaceId: string, fieldId: string): Promise<void>;
  /** Removes the field's values from every task and space, so no orphaned data is left. */
  abstract clearValues(workspaceId: string, fieldId: string): Promise<void>;
}
