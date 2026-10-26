import { Column, Entity, Index } from 'typeorm';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { DocKind } from '@taskflow/shared-types';
import type { Document } from '../domain/document.js';

@Entity({ name: 'document' })
@Index(['workspaceId', 'parentId', 'position'])
export class DocumentOrmEntity extends TenantOrmEntity implements Document {
  @Column({ type: 'uuid', nullable: true })
  spaceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 10, default: 'page' })
  kind: DocKind;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'double precision' })
  position: number;

  @Column({ type: 'text' })
  createdById: string;

  @Column({ type: 'text' })
  updatedById: string;
}
