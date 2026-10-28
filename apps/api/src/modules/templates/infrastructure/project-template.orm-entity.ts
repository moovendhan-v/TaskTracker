import { Column, Entity } from 'typeorm';
import type { TemplateCategory, TemplateContent } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { ProjectTemplate } from '../domain/project-template.js';

@Entity({ name: 'project_template' })
export class ProjectTemplateOrmEntity extends TenantOrmEntity implements ProjectTemplate {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'general' })
  category: TemplateCategory;

  @Column({ type: 'jsonb' })
  content: TemplateContent;

  @Column({ type: 'text', nullable: true })
  createdById: string | null;
}
