import { Injectable } from '@nestjs/common';
import type { DomainEvent } from './domain-event.js';
import { EventBus, type DomainEventHandler } from './event-bus.port.js';

@Injectable()
export class InProcessEventBus extends EventBus {
  private readonly handlers: DomainEventHandler[] = [];

  subscribe(handler: DomainEventHandler): void {
    this.handlers.push(handler);
  }

  /** Sequential on purpose: handlers share the caller's transaction connection. */
  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) await handler(event);
  }
}
