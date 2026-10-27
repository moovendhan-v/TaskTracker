import type { TemplateCategory, TemplateContent } from '@taskflow/shared-types';

/** A workspace's own template. Built-in ones live in code (BUILT_IN_TEMPLATES). */
export interface ProjectTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: TemplateCategory;
  content: TemplateContent;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewProjectTemplate = Pick<ProjectTemplate, 'workspaceId' | 'name' | 'description' | 'category' | 'content' | 'createdById'>;
