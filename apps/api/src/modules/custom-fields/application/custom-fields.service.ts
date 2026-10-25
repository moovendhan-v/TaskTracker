import { randomBytes } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  CUSTOM_FIELD_LIMITS,
  OPERATORS_BY_TYPE,
  type CustomFieldEntity,
  type CustomFieldOption,
  type CustomFieldResponse,
  type CustomFieldValues,
  type FieldType,
  type SaveCustomFieldRequest,
  type SpaceResponse,
} from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { EnumOptionsRegistry } from '../../../core/query/enum-options.registry.js';
import { workspaceFromArg } from '../../../core/runtime/change-target.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { appliesTo, type CustomField } from '../domain/custom-field.js';
import { normalizeValue } from '../domain/custom-field-values.js';
import { CustomFieldRepository } from '../domain/custom-field.repository.js';

const change = { ...workspaceFromArg, targetType: 'custom_field', metadata: (field: CustomFieldResponse) => ({ name: field.name, type: field.type, entity: field.entity }) };

/** How custom field types read in filters: the filter language compares their JSON values. */
const FILTER_TYPE: Record<CustomField['type'], FieldType> = {
  text: 'string',
  url: 'string',
  email: 'string',
  number: 'number',
  money: 'number',
  date: 'date',
  checkbox: 'boolean',
  select: 'enum',
  multi_select: 'string',
  user: 'user',
};

@Injectable()
export class CustomFieldsService implements OnModuleInit {
  constructor(
    private readonly fields: CustomFieldRepository,
    private readonly spacesService: SpacesService,
    private readonly registry: EnumOptionsRegistry,
  ) {}

  /** Task custom fields appear in the tasks table as `custom.<id>`, filterable like any JSON key. */
  onModuleInit(): void {
    this.registry.registerFields('tasks', async (workspaceId) =>
      (await this.list(workspaceId, 'task')).map((field) => ({
        name: `custom.${field.id}`,
        label: field.name,
        type: FILTER_TYPE[field.type],
        operators: OPERATORS_BY_TYPE.json.filter((op) => OPERATORS_BY_TYPE[FILTER_TYPE[field.type]].includes(op) || op === 'eq'),
        sortable: false,
        defaultVisible: false,
        options: field.options.length ? field.options.map((option) => ({ value: option.id, label: option.label, color: option.color ?? null })) : null,
        keyed: false,
        display: field.type,
        width: 160,
      })),
    );
  }

  @Cached({ entities: ['custom_field'], shared: true })
  async list(workspaceId: string, entity?: CustomFieldEntity): Promise<CustomFieldResponse[]> {
    return (await this.fields.list(workspaceId, entity)).map(toResponse);
  }

  @Audited('custom_field.create', change)
  @Announces('custom_field.created', workspaceFromArg)
  async create(_actor: Actor, workspaceId: string, request: SaveCustomFieldRequest): Promise<CustomFieldResponse> {
    if (request.spaceId) await this.spacesService.getInWorkspace(workspaceId, request.spaceId);
    const existing = await this.fields.list(workspaceId);
    if (existing.length >= CUSTOM_FIELD_LIMITS.perWorkspace) throw DomainError.invalid(`A workspace can have at most ${CUSTOM_FIELD_LIMITS.perWorkspace} custom fields`);
    const field = await this.fields.create({
      workspaceId,
      spaceId: request.spaceId ?? null,
      entity: request.entity ?? 'task',
      name: request.name.trim(),
      type: request.type,
      options: withIds(request.type, request.options ?? []),
      required: request.required ?? false,
      position: Math.max(0, ...existing.map((item) => item.position)) + 1,
    });
    return toResponse(field);
  }

  @Audited('custom_field.update', change)
  @Announces('custom_field.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, fieldId: string, request: Partial<Omit<SaveCustomFieldRequest, 'type' | 'entity' | 'spaceId'>>): Promise<CustomFieldResponse> {
    const field = await this.get(workspaceId, fieldId);
    if (request.name !== undefined) field.name = request.name.trim();
    if (request.required !== undefined) field.required = request.required;
    // Options keep their ids, so values that point at them stay valid; removed options simply stop matching.
    if (request.options !== undefined) field.options = withIds(field.type, request.options);
    return toResponse(await this.fields.save(field));
  }

  @Audited('custom_field.delete', change)
  @Announces('custom_field.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, fieldId: string): Promise<CustomFieldResponse> {
    const field = await this.get(workspaceId, fieldId);
    await this.fields.clearValues(workspaceId, fieldId);
    await this.fields.delete(workspaceId, fieldId);
    return toResponse(field);
  }

  /**
   * Checks a patch of custom field values for a task or space and returns what
   * to merge: each key must be a field that applies there, each value must fit
   * its type, and required fields can't be cleared.
   */
  async normalizePatch(workspaceId: string, entity: CustomFieldEntity, spaceId: string | null, patch: CustomFieldValues): Promise<CustomFieldValues> {
    const entries = Object.entries(patch);
    if (entries.length === 0) return {};
    const fields = new Map((await this.fields.list(workspaceId, entity)).map((field) => [field.id, field]));
    const result: CustomFieldValues = {};
    for (const [fieldId, value] of entries) {
      const field = fields.get(fieldId);
      if (!field || !appliesTo(field, entity, spaceId)) throw DomainError.invalid('Unknown custom field');
      if (value === null) {
        if (field.required) throw DomainError.invalid(`${field.name} is required`);
        result[fieldId] = null;
      } else {
        result[fieldId] = normalizeValue(field, value);
      }
    }
    return result;
  }

  /** Sets a space's (project's) custom field values, after checking them like any other values. */
  @Audited('space.custom_fields', { ...workspaceFromArg, targetType: 'space', metadata: (space: SpaceResponse) => ({ name: space.name }) })
  @Announces('space.updated', workspaceFromArg)
  async updateSpaceValues(_actor: Actor, workspaceId: string, spaceId: string, patch: CustomFieldValues): Promise<SpaceResponse> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    return this.spacesService.mergeCustomFields(workspaceId, spaceId, await this.normalizePatch(workspaceId, 'space', spaceId, patch));
  }

  private async get(workspaceId: string, fieldId: string): Promise<CustomField> {
    return found(await this.fields.findInWorkspace(workspaceId, fieldId), 'Custom field');
  }
}

function toResponse(field: CustomField): CustomFieldResponse {
  return { id: field.id, spaceId: field.spaceId, entity: field.entity, name: field.name, type: field.type, options: field.options, required: field.required, position: field.position };
}

/** Select fields need options with stable ids; other types have none. */
function withIds(type: CustomField['type'], options: readonly CustomFieldOption[]): CustomFieldOption[] {
  if (type !== 'select' && type !== 'multi_select') return [];
  if (options.length === 0) throw DomainError.invalid('Give the field at least one option');
  return options.slice(0, CUSTOM_FIELD_LIMITS.optionsMax).map((option) => ({
    id: option.id && /^[A-Za-z0-9_-]{1,32}$/.test(option.id) ? option.id : randomBytes(6).toString('base64url'),
    label: option.label.trim().slice(0, 60),
    color: option.color ?? null,
  }));
}
