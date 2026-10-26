import { REALTIME_ENTITY_TYPES, type RealtimeEntityType } from '@taskflow/shared-types';

/** What changed. Clients map these to the views they need to refresh. */
export const ENTITY_TYPES = REALTIME_ENTITY_TYPES;
export type EntityType = RealtimeEntityType;

export type ChangeKind = 'created' | 'updated' | 'deleted';

/**
 * Something that happened in a workspace, published after a service changes data.
 * Events carry ids, never content: subscribers refetch through normal, authorised
 * queries, so permissions and row-level security still decide what anyone sees.
 */
export interface DomainEvent {
  /** `<entityType>.<change>`, e.g. `task.updated`. */
  type: `${EntityType}.${ChangeKind}`;
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  actorId: string;
  /** Set when only one user may receive the event, such as their own notification. */
  recipientId?: string;
  /** Facts for in-process handlers (notification rules). Never sent to clients. */
  facts?: DomainEventFacts;
}

/** Optional details some handlers need. Each field is set only by the events that have it. */
export interface DomainEventFacts {
  title?: string;
  assigneeId?: string | null;
  previousAssigneeId?: string | null;
  createdById?: string;
  taskId?: string;
  userId?: string;
  status?: string;
  roleName?: string;
  /** A short plain-text quote, e.g. the start of a comment. */
  excerpt?: string;
  /** People following the entity (task watchers). */
  watcherIds?: readonly string[];
  /** What changed, in words: { field: 'status', from: 'To do', to: 'Done' }. */
  changes?: readonly { field: string; from: string | null; to: string | null }[];
  /** The status category after the change, e.g. 'done'. */
  statusCategory?: string;
  number?: number;
  listId?: string;
  spaceId?: string;
}

export function domainEvent(
  entityType: EntityType,
  change: ChangeKind,
  fields: Omit<DomainEvent, 'type' | 'entityType'>,
): DomainEvent {
  return { type: `${entityType}.${change}`, entityType, ...fields };
}

/** The change an audit action describes: `*.create` → created, `*.delete` → deleted, anything else → updated. */
export function changeOfAction(action: string): ChangeKind {
  if (action.endsWith('.create')) return 'created';
  if (action.endsWith('.delete')) return 'deleted';
  return 'updated';
}
