import { Column, Entity } from 'typeorm';
import type { IconKey } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { ListFolder } from '../domain/list-folder.js';

@Entity({ name: 'list_folder' })
export class ListFolderOrmEntity extends TenantOrmEntity implements ListFolder {
  @Column({ type: 'uuid' })
  spaceId: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  icon: IconKey | null;

  @Column({ type: 'double precision', default: 0 })
  position: number;
}
