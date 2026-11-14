import type { IconKey } from '@taskflow/shared-types';

export interface DocTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  icon: IconKey | null;
  content: string;
  createdById: string | null;
  createdAt: Date;
}

/** A workspace's saved doc templates. Every statement names the workspace (RLS enforces it too). */
export abstract class DocTemplateRepository {
  abstract list(workspaceId: string, limit: number): Promise<DocTemplate[]>;
  abstract count(workspaceId: string): Promise<number>;
  abstract find(workspaceId: string, id: string): Promise<DocTemplate | null>;
  abstract create(template: Omit<DocTemplate, 'id' | 'createdAt'>): Promise<DocTemplate>;
  abstract delete(workspaceId: string, id: string): Promise<void>;
}
