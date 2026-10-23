import { z } from 'zod';
import { ENTITY_TYPES, type DomainEvent } from '../events/domain-event.js';

/** The client-facing shape of a domain event: ids only, no content and no facts. */
export interface RealtimeEvent {
  type: string;
  workspaceId: string;
  entityType: DomainEvent['entityType'];
  entityId: string;
  actorId: string;
  recipientId: string | null;
  occurredAt: string;
}

export function toRealtimeEvent(event: DomainEvent, occurredAt: Date): RealtimeEvent {
  return {
    type: event.type,
    workspaceId: event.workspaceId,
    entityType: event.entityType,
    entityId: event.entityId,
    actorId: event.actorId,
    recipientId: event.recipientId ?? null,
    occurredAt: occurredAt.toISOString(),
  };
}

const realtimeEventSchema = z.object({
  type: z.string().regex(/^[a-z_]+\.(created|updated|deleted)$/),
  workspaceId: z.string().uuid(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1).max(64),
  actorId: z.string().min(1).max(64),
  recipientId: z.string().min(1).max(64).nullable(),
  occurredAt: z.string().datetime(),
});

/** Parses a NOTIFY payload. Anything malformed is dropped rather than trusted. */
export function parseRealtimeEvent(payload: string): RealtimeEvent | null {
  try {
    const result = realtimeEventSchema.safeParse(JSON.parse(payload));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
