import { Injectable, Logger } from '@nestjs/common';
import type { RealtimeEvent } from './realtime-event.js';

/** Events waiting for a slow subscriber. Past this, the oldest are dropped (clients refetch anyway). */
const MAX_QUEUED_EVENTS = 100;

type Listener = (event: RealtimeEvent) => void;

/**
 * Fans realtime events out to this instance's subscriptions. Each subscriber
 * gets an async iterator with its own bounded queue, removed when it returns.
 */
@Injectable()
export class EventStream {
  private readonly logger = new Logger(EventStream.name);
  private readonly listeners = new Set<Listener>();

  get subscriberCount(): number {
    return this.listeners.size;
  }

  dispatch(event: RealtimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.error(`Realtime listener failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
  }

  /** Calls `listener` for every event on this instance (cache invalidation). Returns a function that stops it. */
  listen(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribe(accept: (event: RealtimeEvent) => boolean): AsyncIterableIterator<RealtimeEvent> {
    const queue: RealtimeEvent[] = [];
    let waiting: ((result: IteratorResult<RealtimeEvent>) => void) | null = null;
    let closed = false;

    const listener: Listener = (event) => {
      if (closed || !accept(event)) return;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: event, done: false });
        return;
      }
      queue.push(event);
      if (queue.length > MAX_QUEUED_EVENTS) queue.shift();
    };
    this.listeners.add(listener);

    const close = (): Promise<IteratorResult<RealtimeEvent>> => {
      closed = true;
      this.listeners.delete(listener);
      queue.length = 0;
      if (waiting) waiting({ value: undefined, done: true });
      waiting = null;
      return Promise.resolve({ value: undefined, done: true });
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: () => {
        if (closed) return Promise.resolve({ value: undefined, done: true });
        const next = queue.shift();
        if (next) return Promise.resolve({ value: next, done: false });
        return new Promise((resolve) => {
          waiting = resolve;
        });
      },
      return: close,
      throw: async (error?: unknown) => {
        await close();
        throw error;
      },
    };
  }
}
