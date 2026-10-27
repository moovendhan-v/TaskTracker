import {
  COLOR_PATTERN,
  CUSTOM_FIELD_LIMITS,
  CUSTOM_FIELD_TYPES,
  DOC_CONTENT_MAX,
  DOC_KINDS,
  DOC_TITLE_MAX,
  isIconKey,
  NAME_MAX,
  STATUS_CATEGORIES,
  STATUS_NAME_MAX,
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
  TASK_TYPES,
  TEMPLATE_LIMITS,
  type IconKey,
  type TemplateContent,
} from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

const COLOR = new RegExp(COLOR_PATTERN);

/** Reads untrusted JSON one field at a time; every problem names where it is. */
class Reader {
  constructor(private readonly where: string) {}

  object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) this.fail('must be an object');
    return value as Record<string, unknown>;
  }

  list(value: unknown, max: number): unknown[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) this.fail('must be a list');
    if (value.length > max) this.fail(`can have at most ${max} entries`);
    return value;
  }

  text(value: unknown, max: number, { required = true } = {}): string {
    if (value === undefined || value === null || value === '') {
      if (required) this.fail('is required');
      return '';
    }
    if (typeof value !== 'string') this.fail('must be text');
    const trimmed = value.trim();
    if (required && !trimmed) this.fail('is required');
    if (trimmed.length > max) this.fail(`must be at most ${max} characters`);
    return trimmed;
  }

  oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback?: T): T {
    if ((value === undefined || value === null) && fallback !== undefined) return fallback;
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) this.fail(`must be one of ${allowed.join(', ')}`);
    return value as T;
  }

  color(value: unknown, { required = false } = {}): string | null {
    if (value === undefined || value === null) {
      if (required) this.fail('needs a colour');
      return null;
    }
    if (typeof value !== 'string' || !COLOR.test(value)) this.fail('must be a colour like #22c55e');
    return value;
  }

  icon(value: unknown): IconKey | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || !isIconKey(value)) this.fail('is not a known icon');
    return value as IconKey;
  }

  /** An index into an earlier list, or null. */
  index(value: unknown, below: number): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= below) this.fail('points at something that does not exist');
    return value as number;
  }

  fail(problem: string): never {
    throw DomainError.invalid(`Template ${this.where} ${problem}`);
  }

  at(where: string): Reader {
    return new Reader(`${this.where}.${where}`.replace(/^\./, ''));
  }
}

/**
 * Checks and normalizes template content from anywhere (built-in, saved, or an
 * imported file). Unknown keys are dropped, every string is bounded, every
 * reference must point at an earlier entry, so applying it can't loop or fail halfway.
 */
export const TemplateContentPolicy = {
  normalize(raw: unknown): TemplateContent {
    const root = new Reader('content');
    const content = root.object(raw);
    if (content['version'] !== 1) root.at('version').fail('must be 1');

    const space = root.at('space').object(content['space'] ?? {});
    const statuses = root.at('statuses').list(content['statuses'], TEMPLATE_LIMITS.statuses).map((item, index) => {
      const reader = root.at(`statuses[${index}]`);
      const status = reader.object(item);
      return {
        name: reader.at('name').text(status['name'], STATUS_NAME_MAX),
        color: reader.at('color').color(status['color'], { required: true }) as string,
        category: reader.at('category').oneOf(status['category'], STATUS_CATEGORIES),
      };
    });
    const names = statuses.map((status) => status.name.toLowerCase());
    if (new Set(names).size !== names.length) root.at('statuses').fail('must have different names');

    const customFields = root.at('customFields').list(content['customFields'], TEMPLATE_LIMITS.customFields).map((item, index) => {
      const reader = root.at(`customFields[${index}]`);
      const field = reader.object(item);
      const type = reader.at('type').oneOf(field['type'], CUSTOM_FIELD_TYPES);
      const options = reader
        .at('options')
        .list(field['options'], CUSTOM_FIELD_LIMITS.optionsMax)
        .map((option, at) => {
          const optionReader = reader.at(`options[${at}]`);
          const value = optionReader.object(option);
          return { label: optionReader.at('label').text(value['label'], 60), color: optionReader.at('color').color(value['color']) };
        });
      if ((type === 'select' || type === 'multi_select') && options.length === 0) reader.at('options').fail('are needed for this type');
      return { name: reader.at('name').text(field['name'], CUSTOM_FIELD_LIMITS.nameMax), type, options, required: field['required'] === true };
    });

    const folders: TemplateContent['folders'] = [];
    for (const [index, item] of root.at('folders').list(content['folders'], TEMPLATE_LIMITS.folders).entries()) {
      const reader = root.at(`folders[${index}]`);
      const folder = reader.object(item);
      folders.push({
        name: reader.at('name').text(folder['name'], NAME_MAX),
        icon: reader.at('icon').icon(folder['icon']),
        color: reader.at('color').color(folder['color']),
        parent: reader.at('parent').index(folder['parent'], index),
      });
    }

    const lists = root.at('lists').list(content['lists'], TEMPLATE_LIMITS.lists).map((item, index) => {
      const reader = root.at(`lists[${index}]`);
      const list = reader.object(item);
      return {
        name: reader.at('name').text(list['name'], NAME_MAX),
        icon: reader.at('icon').icon(list['icon']),
        color: reader.at('color').color(list['color']),
        folder: reader.at('folder').index(list['folder'], folders.length),
      };
    });

    const tasks = root.at('tasks').list(content['tasks'], TEMPLATE_LIMITS.tasks).map((item, index) => {
      const reader = root.at(`tasks[${index}]`);
      const task = reader.object(item);
      const list = reader.at('list').index(task['list'], lists.length) ?? reader.at('list').fail('is required');
      const status = reader.at('status').text(task['status'], STATUS_NAME_MAX, { required: false });
      if (status && statuses.length && !names.includes(status.toLowerCase())) reader.at('status').fail('is not one of the template’s statuses');
      const estimate = task['estimateMinutes'];
      if (estimate !== undefined && estimate !== null && (typeof estimate !== 'number' || !Number.isInteger(estimate) || estimate < 0 || estimate > 100_000)) {
        reader.at('estimateMinutes').fail('must be a whole number of minutes');
      }
      return {
        title: reader.at('title').text(task['title'], TASK_TITLE_MAX),
        list,
        description: reader.at('description').text(task['description'], TASK_DESCRIPTION_MAX, { required: false }),
        status: status || undefined,
        priority: reader.at('priority').oneOf(task['priority'], TASK_PRIORITIES, 'none'),
        type: reader.at('type').oneOf(task['type'], TASK_TYPES, 'task'),
        estimateMinutes: (estimate as number | null | undefined) ?? null,
        subtasks: reader
          .at('subtasks')
          .list(task['subtasks'], TEMPLATE_LIMITS.subtasksPerTask)
          .map((title, at) => reader.at(`subtasks[${at}]`).text(title, TASK_TITLE_MAX)),
      };
    });

    const docs: TemplateContent['docs'] = [];
    for (const [index, item] of root.at('docs').list(content['docs'], TEMPLATE_LIMITS.docs).entries()) {
      const reader = root.at(`docs[${index}]`);
      const doc = reader.object(item);
      const kind = reader.at('kind').oneOf(doc['kind'], DOC_KINDS, 'page');
      const parent = reader.at('parent').index(doc['parent'], index);
      if (kind === 'folder' && parent !== null && docs[parent]?.kind !== 'folder') reader.at('parent').fail('must be a folder for a folder');
      docs.push({
        title: reader.at('title').text(doc['title'], DOC_TITLE_MAX),
        kind,
        icon: reader.at('icon').icon(doc['icon']),
        content: kind === 'folder' ? '' : reader.at('content').text(doc['content'], DOC_CONTENT_MAX, { required: false }),
        parent,
      });
    }

    return {
      version: 1,
      space: { color: root.at('space.color').color(space['color']) ?? '#0ea5e9', icon: root.at('space.icon').icon(space['icon']) },
      statuses,
      customFields,
      folders,
      lists,
      tasks,
      docs,
    };
  },

  /** Parses an imported file. JSON.parse builds plain data only, so this is safe on untrusted text. */
  parse(json: string): TemplateContent {
    if (json.length > TEMPLATE_LIMITS.importBytesMax) throw DomainError.invalid('That file is too large for a template');
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw DomainError.invalid('That file is not valid JSON');
    }
    // An exported file may carry its name and description around the content.
    const wrapped = raw && typeof raw === 'object' && !Array.isArray(raw) && 'content' in raw ? (raw as { content: unknown }).content : raw;
    return TemplateContentPolicy.normalize(wrapped);
  },
};
