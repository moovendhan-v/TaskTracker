import { Column, Entity } from 'typeorm';
import { BaseOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { Workspace } from '../domain/workspace.js';

@Entity({ name: 'workspace' })
export class WorkspaceOrmEntity extends BaseOrmEntity implements Workspace {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'text' })
  ownerId: string;
}
