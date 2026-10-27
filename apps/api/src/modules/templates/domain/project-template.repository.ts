import type { NewProjectTemplate, ProjectTemplate } from './project-template.js';

export abstract class ProjectTemplateRepository {
  abstract list(workspaceId: string): Promise<ProjectTemplate[]>;
  abstract count(workspaceId: string): Promise<number>;
  abstract findInWorkspace(workspaceId: string, templateId: string): Promise<ProjectTemplate | null>;
  abstract create(template: NewProjectTemplate): Promise<ProjectTemplate>;
  abstract delete(workspaceId: string, templateId: string): Promise<void>;
}
