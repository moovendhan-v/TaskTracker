import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Clock } from '../time/clock.port.js';
import { TransactionalManager } from '../database/transactional-manager.js';
import type { DomainEvent } from '../events/domain-event.js';
import { EventBus } from '../events/event-bus.port.js';
import { REALTIME_CHANNEL } from './realtime-channel.js';
import { toRealtimeEvent } from './realtime-event.js';

/**
 * Sends every domain event to Postgres NOTIFY in the caller's transaction.
 * Postgres delivers it only when that transaction commits, so subscribers never
 * hear about a change that was rolled back, and every API instance hears it.
 */
@Injectable()
export class RealtimePublisher implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly transactional: TransactionalManager,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe((event) => this.publish(event));
  }

  private async publish(event: DomainEvent): Promise<void> {
    const payload = JSON.stringify(toRealtimeEvent(event, this.clock.now()));
    await this.transactional.manager.query('SELECT pg_notify($1, $2)', [REALTIME_CHANNEL, payload]);
  }
}
