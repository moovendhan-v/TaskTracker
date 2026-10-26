import { Column, Entity } from 'typeorm';
import type { CustomFieldEntity, CustomFieldOption, CustomFieldType } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { CustomField } from '../domain/custom-field.js';

@Entity({ name: 'custom_field' })
export class CustomFieldOrmEntity extends TenantOrmEntity implements CustomField {
  @Column({ type: 'uuid', nullable: true })
  spaceId: string | null;

  @Column({ type: 'varchar', length: 10 })
  entity: CustomFieldEntity;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  type: CustomFieldType;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  options: CustomFieldOption[];

  @Column({ type: 'boolean', default: false })
  required: boolean;

  @Column({ type: 'integer', default: 0 })
  position: number;
}
