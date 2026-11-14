import { Injectable } from '@nestjs/common';
import { BUILT_IN_DOC_TEMPLATES, DOC_CONTENT_MAX, DOC_TEMPLATE_LIMITS, type DocTemplateResponse, type SaveDocTemplateRequest } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ContentSanitizer } from '../domain/content-sanitizer.port.js';
import { DocTemplateRepository, type DocTemplate } from '../domain/doc-template.repository.js';

const toResponse = (template: DocTemplate): DocTemplateResponse => ({
  id: template.id,
  name: template.name,
  description: template.description,
  icon: template.icon,
  content: template.content,
  builtIn: false,
  createdById: template.createdById,
  createdAt: template.createdAt.toISOString(),
});

/**
 * Doc templates: the built-in starters and the workspace's own. Saving one needs
 * doc.create (the resolver checks) and sanitizes the text like any page; deleting
 * needs to be the person who saved it, or doc.manage. A new page from a template
 * is made with the ordinary createDocument, so it's checked and sanitized again.
 */
@Injectable()
export class DocTemplatesService {
  constructor(
    private readonly templates: DocTemplateRepository,
    private readonly sanitizer: ContentSanitizer,
  ) {}

  async list(workspaceId: string): Promise<DocTemplateResponse[]> {
    return [...BUILT_IN_DOC_TEMPLATES, ...(await this.templates.list(workspaceId, DOC_TEMPLATE_LIMITS.perWorkspace)).map(toResponse)];
  }

  async save(actor: Actor, workspaceId: string, request: SaveDocTemplateRequest): Promise<DocTemplateResponse> {
    const name = request.name.trim();
    if (!name || name.length > DOC_TEMPLATE_LIMITS.nameMax) throw DomainError.invalid(`Give the template a name of up to ${DOC_TEMPLATE_LIMITS.nameMax} characters`);
    const description = (request.description ?? '').trim();
    if (description.length > DOC_TEMPLATE_LIMITS.descriptionMax) throw DomainError.invalid(`The description can be at most ${DOC_TEMPLATE_LIMITS.descriptionMax} characters`);
    if (request.content.length > DOC_CONTENT_MAX) throw DomainError.invalid('That page is too long to keep as a template');
    if ((await this.templates.count(workspaceId)) >= DOC_TEMPLATE_LIMITS.perWorkspace) throw DomainError.invalid(`A workspace can keep at most ${DOC_TEMPLATE_LIMITS.perWorkspace} doc templates`);
    const saved = await this.templates.create({ workspaceId, name, description, icon: request.icon ?? null, content: this.sanitizer.sanitize(request.content), createdById: actor.userId });
    return toResponse(saved);
  }

  async remove(actor: Actor, access: WorkspaceAccess, id: string): Promise<boolean> {
    const template = await this.templates.find(access.workspaceId, id);
    if (!template) throw DomainError.notFound('Template');
    if (template.createdById !== actor.userId && !access.permissions.has('doc.manage')) throw DomainError.forbidden('Only whoever saved this template, or someone who manages docs, can delete it');
    await this.templates.delete(access.workspaceId, id);
    return true;
  }
}
