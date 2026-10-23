import type { DomainEvent } from './domain-event.js';

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Publishes domain events to in-process handlers. Handlers run in the caller's
 * transaction, one after another, so what they write commits or rolls back with
 * the change that caused it.
 */
export abstract class EventBus {
  abstract publish(event: DomainEvent): Promise<void>;
  abstract subscribe(handler: DomainEventHandler): void;
}
