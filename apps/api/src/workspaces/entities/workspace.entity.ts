import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

@Entity({ name: 'workspace' })
export class WorkspaceEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'text' })
  ownerId: string;
}
