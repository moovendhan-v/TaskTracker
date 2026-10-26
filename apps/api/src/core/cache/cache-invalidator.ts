import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { EventBus } from '../events/event-bus.port.js';
import { EventStream } from '../realtime/event-stream.js';
import { entityTag, type CacheTopic } from './cache-keys.js';
import { CacheStore } from './cache-store.port.js';

/**
 * Changes to one entity type that also change what is cached for others. A new
 * role permission, for example, changes what every member may do.
 */
const ALSO_INVALIDATES: Partial<Record<CacheTopic, readonly CacheTopic[]>> = {
  role: ['member', 'access'],
  member: ['access'],
  policy: ['access', 'member'],
  workspace: ['access'],
  space: ['list', 'task', 'status'],
  list: ['task'],
  status: ['task'],
  custom_field: ['task', 'space'],
  time_entry: ['task'],
  sprint: ['task'],
  employee: ['member'],
};

export function tagsForChange(workspaceId: string, entityType: CacheTopic): string[] {
  return [entityType, ...(ALSO_INVALIDATES[entityType] ?? [])].map((entity) => entityTag(workspaceId, entity));
}

/**
 * Drops cached reads when their data changes. It listens twice: on the in-process
 * EventBus, so the instance that made the change stops serving the old value at
 * once, and on the post-commit realtime stream, which reaches every instance and
 * also clears anything a concurrent read cached before the commit.
 */
@Injectable()
export class CacheInvalidator implements OnModuleInit, OnModuleDestroy {
  private unlisten: (() => void) | null = null;

  constructor(
    private readonly cache: CacheStore,
    private readonly eventBus: EventBus,
    private readonly stream: EventStream,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe((event) => this.cache.invalidateTags(tagsForChange(event.workspaceId, event.entityType)));
    this.unlisten = this.stream.listen((event) => void this.cache.invalidateTags(tagsForChange(event.workspaceId, event.entityType)));
  }

  onModuleDestroy(): void {
    this.unlisten?.();
  }
}
