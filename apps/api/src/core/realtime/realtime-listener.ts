import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { EventStream } from './event-stream.js';
import { REALTIME_CHANNEL } from './realtime-channel.js';
import { parseRealtimeEvent } from './realtime-event.js';

const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/**
 * Holds one dedicated Postgres connection that LISTENs for realtime events from
 * every API instance and hands them to this instance's EventStream. Reconnects
 * with backoff; events sent while it is down are missed, and clients catch up
 * with their next query.
 */
@Injectable()
export class RealtimeListener implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeListener.name);
  private client: pg.Client | null = null;
  private retryMs = RETRY_MIN_MS;
  private retryTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly stream: EventStream,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    await this.client?.end().catch(() => undefined);
    this.client = null;
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = new pg.Client({
      connectionString: this.env.DATABASE_URL,
      ssl: this.env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
    });
    client.on('notification', (message) => {
      if (message.channel !== REALTIME_CHANNEL || !message.payload) return;
      const event = parseRealtimeEvent(message.payload);
      if (event) this.stream.dispatch(event);
      else this.logger.warn('Dropped a malformed realtime event');
    });
    client.on('error', (error) => this.reconnect(client, error));
    client.on('end', () => this.reconnect(client, null));

    try {
      await client.connect();
      await client.query(`LISTEN ${REALTIME_CHANNEL}`);
      this.client = client;
      this.retryMs = RETRY_MIN_MS;
    } catch (error) {
      this.reconnect(client, error);
    }
  }

  private reconnect(client: pg.Client, error: unknown): void {
    if (this.stopped || this.retryTimer || (this.client && this.client !== client)) return;
    if (error) this.logger.warn(`Realtime connection lost, retrying in ${this.retryMs / 1000}s: ${error instanceof Error ? error.message : 'unknown error'}`);
    this.client = null;
    client.removeAllListeners();
    void client.end().catch(() => undefined);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
  }
}
