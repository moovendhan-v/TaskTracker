import type { CreateFromTemplateRequest, ImportTemplateRequest, SaveAsTemplateRequest, TemplateContent, TemplateResponse } from '@taskflow/shared-types';
import {
  CreateSpaceFromTemplateDocument,
  DeleteTemplateDocument,
  ImportTemplateDocument,
  ProjectTemplatesDocument,
  SaveSpaceAsTemplateDocument,
  SpaceTemplateContentDocument,
  type TemplateFieldsFragment,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** The API checks template content before storing or returning it; this only gives it its type back. */
const toTemplate = (template: TemplateFieldsFragment): TemplateResponse => ({ ...template, content: template.content as unknown as TemplateContent });

export const templatesApi = {
  list: async (workspaceId: string) => (await graphql(ProjectTemplatesDocument, { workspaceId })).projectTemplates.map(toTemplate),
  apply: async (workspaceId: string, templateId: string, input: CreateFromTemplateRequest) =>
    (await graphql(CreateSpaceFromTemplateDocument, { workspaceId, templateId, input })).createSpaceFromTemplate,
  saveFromSpace: async (workspaceId: string, spaceId: string, input: SaveAsTemplateRequest) =>
    toTemplate((await graphql(SaveSpaceAsTemplateDocument, { workspaceId, spaceId, input })).saveSpaceAsTemplate),
  importJson: async (workspaceId: string, input: ImportTemplateRequest) => toTemplate((await graphql(ImportTemplateDocument, { workspaceId, input })).importTemplate),
  remove: async (workspaceId: string, templateId: string) => (await graphql(DeleteTemplateDocument, { workspaceId, templateId })).deleteTemplate,
  spaceContent: async (workspaceId: string, spaceId: string, includeContent: boolean) =>
    (await graphql(SpaceTemplateContentDocument, { workspaceId, spaceId, includeContent })).spaceTemplateContent as unknown as TemplateContent,
};
