import { Injectable } from '@nestjs/common';
import type { CustomFieldEntity } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { CustomField, NewCustomField } from '../domain/custom-field.js';
import { CustomFieldRepository } from '../domain/custom-field.repository.js';
import { CustomFieldOrmEntity } from './custom-field.orm-entity.js';

@Injectable()
export class TypeOrmCustomFieldRepository extends CustomFieldRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(CustomFieldOrmEntity);
  }

  list(workspaceId: string, entity?: CustomFieldEntity): Promise<CustomField[]> {
    return this.repository.find({ where: entity ? { workspaceId, entity } : { workspaceId }, order: { position: 'ASC', createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, fieldId: string): Promise<CustomField | null> {
    return this.repository.findOneBy({ id: fieldId, workspaceId });
  }

  create(field: NewCustomField): Promise<CustomField> {
    return this.repository.save(this.repository.create(field));
  }

  save(field: CustomField): Promise<CustomField> {
    return this.repository.save(this.repository.create(field));
  }

  async delete(workspaceId: string, fieldId: string): Promise<void> {
    await this.repository.delete({ id: fieldId, workspaceId });
  }

  async clearValues(workspaceId: string, fieldId: string): Promise<void> {
    for (const table of ['task', 'space']) {
      // Table names are fixed above; the field id is a bound parameter.
      await this.transactional.manager.query(
        `UPDATE ${table} SET custom_fields = custom_fields - $2::text WHERE workspace_id = $1 AND custom_fields ? $2::text`,
        [workspaceId, fieldId],
      );
    }
  }
}
