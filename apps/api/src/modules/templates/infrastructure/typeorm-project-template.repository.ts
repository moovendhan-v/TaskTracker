import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewProjectTemplate, ProjectTemplate } from '../domain/project-template.js';
import { ProjectTemplateRepository } from '../domain/project-template.repository.js';
import { ProjectTemplateOrmEntity } from './project-template.orm-entity.js';

@Injectable()
export class TypeOrmProjectTemplateRepository extends ProjectTemplateRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(ProjectTemplateOrmEntity);
  }

  list(workspaceId: string): Promise<ProjectTemplate[]> {
    return this.repository.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
  }

  count(workspaceId: string): Promise<number> {
    return this.repository.countBy({ workspaceId });
  }

  findInWorkspace(workspaceId: string, templateId: string): Promise<ProjectTemplate | null> {
    return this.repository.findOneBy({ id: templateId, workspaceId });
  }

  create(template: NewProjectTemplate): Promise<ProjectTemplate> {
    return this.repository.save(this.repository.create(template));
  }

  async delete(workspaceId: string, templateId: string): Promise<void> {
    await this.repository.delete({ id: templateId, workspaceId });
  }
}
