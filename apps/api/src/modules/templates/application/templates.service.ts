import { Injectable } from '@nestjs/common';
import {
  BUILT_IN_TEMPLATES,
  TEMPLATE_LIMITS,
  type CreateFromTemplateRequest,
  type ImportTemplateRequest,
  type SaveAsTemplateRequest,
  type SpaceResponse,
  type TemplateContent,
  type TemplateResponse,
} from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { CustomFieldsService } from '../../custom-fields/application/custom-fields.service.js';
import { DocumentsService } from '../../documents/application/documents.service.js';
import { FoldersService } from '../../lists/application/folders.service.js';
import { ListsService } from '../../lists/application/lists.service.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { StatusesService } from '../../statuses/application/statuses.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import type { ProjectTemplate } from '../domain/project-template.js';
import { ProjectTemplateRepository } from '../domain/project-template.repository.js';
import { TemplateContentPolicy } from '../domain/template-content.policy.js';

const BUILT_IN_PREFIX = 'builtin:';

const templateChange = { ...workspaceFromAccess, targetType: 'template', metadata: (template: TemplateResponse) => ({ name: template.name }) };

/**
 * Project templates: the built-in gallery, the workspace's own templates, and
 * turning either into a new space (or a space into a template). Applying runs
 * through the normal services, so every rule, audit entry and event applies,
 * and in the operation's single transaction, so it lands whole or not at all.
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly templates: ProjectTemplateRepository,
    private readonly spacesService: SpacesService,
    private readonly statusesService: StatusesService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly foldersService: FoldersService,
    private readonly listsService: ListsService,
    private readonly tasksService: TasksService,
    private readonly documentsService: DocumentsService,
  ) {}

  async list(workspaceId: string): Promise<TemplateResponse[]> {
    const own = await this.templates.list(workspaceId);
    return [...BUILT_IN_TEMPLATES.map((template) => toResponse({ ...template, id: `${BUILT_IN_PREFIX}${template.key}`, builtIn: true, createdAt: null })), ...own.map(fromRow)];
  }

  async get(workspaceId: string, templateId: string): Promise<TemplateResponse> {
    if (templateId.startsWith(BUILT_IN_PREFIX)) {
      const template = found(BUILT_IN_TEMPLATES.find((item) => `${BUILT_IN_PREFIX}${item.key}` === templateId) ?? null, 'Template');
      return toResponse({ ...template, id: templateId, builtIn: true, createdAt: null });
    }
    if (!UUID.test(templateId)) throw DomainError.notFound('Template');
    return fromRow(found(await this.templates.findInWorkspace(workspaceId, templateId), 'Template'));
  }

  /** Creates a space from a template: statuses, custom fields, folders, lists and (optionally) starter tasks and docs. */
  @Audited('template.apply', {
    ...workspaceFromAccess,
    targetType: 'space',
    metadata: (space: SpaceResponse) => ({ name: space.name }),
  })
  async apply(actor: Actor, access: WorkspaceAccess, templateId: string, request: CreateFromTemplateRequest): Promise<SpaceResponse> {
    const { workspaceId } = access;
    const template = await this.get(workspaceId, templateId);
    const content = TemplateContentPolicy.normalize(template.content);
    const includeContent = request.includeContent ?? true;
    if (includeContent && content.tasks.length && !access.permissions.has('task.create')) throw DomainError.forbidden('You need task.create to add the starter tasks');
    if (includeContent && content.docs.length && !access.permissions.has('doc.create')) throw DomainError.forbidden('You need doc.create to add the starter docs');

    const space = await this.spacesService.create(actor, workspaceId, {
      name: request.name.trim(),
      color: request.color ?? content.space.color,
      icon: request.icon === undefined ? content.space.icon : request.icon,
    });
    const statuses = content.statuses.length ? await this.statusesService.replaceForNewSpace(workspaceId, space.id, content.statuses) : await this.statusesService.listForSpace(workspaceId, space.id);
    const statusByName = new Map(statuses.map((status) => [status.name.toLowerCase(), status.id]));

    // Sequential throughout: the operation's queries share one transaction connection.
    for (const field of content.customFields) {
      await this.customFieldsService.create(actor, workspaceId, {
        name: field.name,
        type: field.type,
        entity: 'task',
        spaceId: space.id,
        options: (field.options ?? []).map((option) => ({ id: '', label: option.label, color: option.color ?? null })),
        required: field.required ?? false,
      });
    }
    const folderIds: string[] = [];
    for (const folder of content.folders) {
      const parentId = folder.parent === null || folder.parent === undefined ? null : (folderIds[folder.parent] ?? null);
      folderIds.push((await this.foldersService.create(actor, workspaceId, space.id, { name: folder.name, icon: folder.icon ?? null, color: folder.color ?? null, parentId })).id);
    }
    const listIds: string[] = [];
    for (const list of content.lists) {
      const folderId = list.folder === null || list.folder === undefined ? null : (folderIds[list.folder] ?? null);
      listIds.push((await this.listsService.create(actor, workspaceId, space.id, { name: list.name, icon: list.icon ?? null, color: list.color ?? null, folderId })).id);
    }

    if (includeContent) {
      for (const task of content.tasks) {
        const listId = listIds[task.list];
        if (!listId) continue;
        const statusId = task.status ? statusByName.get(task.status.toLowerCase()) : undefined;
        const created = await this.tasksService.create(actor, access, listId, {
          title: task.title,
          description: task.description ?? '',
          priority: task.priority ?? 'none',
          type: task.type ?? 'task',
          ...(statusId ? { statusId } : {}),
          ...(task.estimateMinutes ? { estimateMinutes: task.estimateMinutes } : {}),
        });
        for (const title of task.subtasks ?? []) await this.tasksService.create(actor, access, listId, { title, parentId: created.id });
      }
      const docIds: string[] = [];
      for (const doc of content.docs) {
        const parentId = doc.parent === null || doc.parent === undefined ? null : (docIds[doc.parent] ?? null);
        const created = await this.documentsService.create(actor, workspaceId, {
          title: doc.title,
          kind: doc.kind ?? 'page',
          icon: doc.icon ?? null,
          content: doc.content ?? '',
          ...(parentId ? { parentId } : { spaceId: space.id }),
        });
        docIds.push(created.id);
      }
    }
    return space;
  }

  /** Saves a space's structure (and, optionally, its open tasks and docs) as a new template of this workspace. */
  @Audited('template.create', templateChange)
  async saveFromSpace(actor: Actor, access: WorkspaceAccess, spaceId: string, request: SaveAsTemplateRequest): Promise<TemplateResponse> {
    const content = await this.contentOfSpace(access.workspaceId, spaceId, request.includeContent ?? false);
    return this.store(actor, access.workspaceId, { name: request.name, description: request.description, category: request.category }, content);
  }

  /** Adds a template from an exported JSON file, after checking every field. */
  @Audited('template.import', templateChange)
  async importJson(actor: Actor, access: WorkspaceAccess, request: ImportTemplateRequest): Promise<TemplateResponse> {
    return this.store(actor, access.workspaceId, request, TemplateContentPolicy.parse(request.json));
  }

  @Audited('template.delete', templateChange)
  async remove(_actor: Actor, access: WorkspaceAccess, templateId: string): Promise<TemplateResponse> {
    if (templateId.startsWith(BUILT_IN_PREFIX)) throw DomainError.invalid('Built-in templates can’t be deleted');
    const template = await this.get(access.workspaceId, templateId);
    await this.templates.delete(access.workspaceId, templateId);
    return template;
  }

  /** What a space would look like as a template, for exporting without saving. */
  async contentOfSpace(workspaceId: string, spaceId: string, includeContent: boolean): Promise<TemplateContent> {
    const space = await this.spacesService.getInWorkspace(workspaceId, spaceId);
    const statuses = await this.statusesService.listForSpace(workspaceId, spaceId);
    const fields = (await this.customFieldsService.list(workspaceId, 'task')).filter((field) => field.spaceId === spaceId);
    const folders = parentsFirst((await this.foldersService.listForWorkspace(workspaceId)).filter((folder) => folder.spaceId === spaceId));
    const folderIndex = new Map(folders.map((folder, index) => [folder.id, index]));
    const lists = (await this.listsService.listForWorkspace(workspaceId)).filter((list) => list.spaceId === spaceId);
    const listIndex = new Map(lists.map((list, index) => [list.id, index]));

    const content: TemplateContent = {
      version: 1,
      space: { color: space.color, icon: space.icon },
      statuses: statuses.map((status) => ({ name: status.name, color: status.color, category: status.category })),
      customFields: fields.map((field) => ({ name: field.name, type: field.type, options: field.options.map((option) => ({ label: option.label, color: option.color ?? null })), required: field.required })),
      folders: folders.map((folder) => ({ name: folder.name, icon: folder.icon, color: folder.color, parent: folder.parentId ? (folderIndex.get(folder.parentId) ?? null) : null })),
      lists: lists.map((list) => ({ name: list.name, icon: list.icon, color: list.color, folder: list.folderId ? (folderIndex.get(list.folderId) ?? null) : null })),
      tasks: [],
      docs: [],
    };
    if (!includeContent) return content;

    const open = await this.tasksService.openInSpace(workspaceId, spaceId, TEMPLATE_LIMITS.tasks);
    content.tasks = open
      .filter((task) => !task.parentId && listIndex.has(task.listId))
      .map((task) => ({
        title: task.title,
        list: listIndex.get(task.listId) as number,
        description: task.description,
        status: task.status.name,
        priority: task.priority,
        type: task.type,
        estimateMinutes: task.estimateMinutes,
        subtasks: open
          .filter((subtask) => subtask.parentId === task.id)
          .slice(0, TEMPLATE_LIMITS.subtasksPerTask)
          .map((subtask) => subtask.title),
      }));
    const docs = parentsFirst((await this.documentsService.listTree(workspaceId)).filter((doc) => doc.spaceId === spaceId)).slice(0, TEMPLATE_LIMITS.docs);
    const docIndex = new Map(docs.map((doc, index) => [doc.id, index]));
    for (const doc of docs) {
      const full = await this.documentsService.get(workspaceId, doc.id);
      content.docs.push({ title: doc.title, kind: doc.kind, icon: doc.icon, content: full.content, parent: doc.parentId ? (docIndex.get(doc.parentId) ?? null) : null });
    }
    return TemplateContentPolicy.normalize(content);
  }

  private async store(actor: Actor, workspaceId: string, meta: Pick<ImportTemplateRequest, 'name' | 'description' | 'category'>, content: TemplateContent): Promise<TemplateResponse> {
    if ((await this.templates.count(workspaceId)) >= TEMPLATE_LIMITS.perWorkspace) throw DomainError.invalid(`A workspace can keep at most ${TEMPLATE_LIMITS.perWorkspace} templates`);
    const row = await this.templates.create({
      workspaceId,
      name: meta.name.trim(),
      description: meta.description?.trim() ?? '',
      category: meta.category ?? 'general',
      content,
      createdById: actor.userId,
    });
    return fromRow(row);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Orders tree nodes so every parent comes before its children (orphans count as roots). */
function parentsFirst<T extends { id: string; parentId: string | null }>(nodes: readonly T[]): T[] {
  const ids = new Set(nodes.map((node) => node.id));
  const ordered: T[] = [];
  const visit = (parentId: string | null) => {
    for (const node of nodes) {
      const parent = node.parentId && ids.has(node.parentId) ? node.parentId : null;
      if (parent === parentId) {
        ordered.push(node);
        visit(node.id);
      }
    }
  };
  visit(null);
  return ordered;
}

function fromRow(row: ProjectTemplate): TemplateResponse {
  return toResponse({ id: row.id, name: row.name, description: row.description, category: row.category, content: row.content, builtIn: false, createdAt: row.createdAt.toISOString() });
}

function toResponse(template: Pick<TemplateResponse, 'id' | 'name' | 'description' | 'category' | 'content' | 'builtIn' | 'createdAt'>): TemplateResponse {
  const { content } = template;
  return {
    ...template,
    icon: content.space.icon,
    color: content.space.color,
    counts: {
      statuses: content.statuses.length,
      customFields: content.customFields.length,
      folders: content.folders.length,
      lists: content.lists.length,
      tasks: content.tasks.length,
      docs: content.docs.length,
    },
  };
}
