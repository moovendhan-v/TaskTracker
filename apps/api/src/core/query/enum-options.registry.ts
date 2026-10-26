import { Injectable } from '@nestjs/common';
import type { EnumOption, ResourceFieldSchema } from '@taskflow/shared-types';

/** Loads the options of an enum field that differ per workspace, such as custom statuses. */
export type EnumOptionsProvider = (workspaceId: string) => Promise<EnumOption[]>;

/** Loads extra fields a workspace adds to a resource, such as custom fields (`custom.<id>`). */
export type FieldsProvider = (workspaceId: string) => Promise<ResourceFieldSchema[]>;

/**
 * Feature modules register workspace-specific enum options here; the resource
 * schema then publishes them instead of the static ones. The filter validator
 * doesn't use them: fields whose values vary per workspace are `string` or
 * `uuid` fields that only *display* as enums.
 */
@Injectable()
export class EnumOptionsRegistry {
  private readonly providers = new Map<string, Map<string, EnumOptionsProvider>>();
  private readonly fieldProviders = new Map<string, FieldsProvider[]>();

  registerFields(resource: string, provider: FieldsProvider): void {
    this.fieldProviders.set(resource, [...(this.fieldProviders.get(resource) ?? []), provider]);
  }

  async fieldsFor(resource: string, workspaceId: string): Promise<ResourceFieldSchema[]> {
    const fields: ResourceFieldSchema[] = [];
    for (const provider of this.fieldProviders.get(resource) ?? []) fields.push(...(await provider(workspaceId)));
    return fields;
  }

  register(resource: string, field: string, provider: EnumOptionsProvider): void {
    let fields = this.providers.get(resource);
    if (!fields) this.providers.set(resource, (fields = new Map()));
    fields.set(field, provider);
  }

  async optionsFor(resource: string, workspaceId: string): Promise<Map<string, EnumOption[]>> {
    const result = new Map<string, EnumOption[]>();
    // Sequential: providers share the operation's single transaction connection.
    for (const [field, provider] of this.providers.get(resource) ?? []) result.set(field, await provider(workspaceId));
    return result;
  }
}
