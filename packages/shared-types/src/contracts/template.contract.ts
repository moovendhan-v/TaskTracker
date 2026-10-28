import type { IconKey } from '../domain/hierarchy.js';
import type { TemplateCategory, TemplateContent } from '../domain/template.js';

export interface TemplateResponse {
  /** `builtin:<key>` for templates that ship with the app, otherwise a UUID. */
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  builtIn: boolean;
  icon: IconKey | null;
  color: string;
  /** Sizes, for the gallery card. */
  counts: { statuses: number; customFields: number; folders: number; lists: number; tasks: number; docs: number };
  content: TemplateContent;
  createdAt: string | null;
}

export interface CreateFromTemplateRequest {
  name: string;
  color?: string;
  icon?: IconKey | null;
  /** Starter tasks and docs; off gives only the structure. */
  includeContent?: boolean;
}

export interface SaveAsTemplateRequest {
  name: string;
  description?: string;
  category?: TemplateCategory;
  /** Copy the space's open tasks and its docs too. */
  includeContent?: boolean;
}

export interface ImportTemplateRequest {
  name: string;
  description?: string;
  category?: TemplateCategory;
  /** The exported JSON (a TemplateContent), as text. */
  json: string;
}
