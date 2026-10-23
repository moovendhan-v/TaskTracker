import { createClient, type Client } from 'graphql-ws';
import { inject } from 'vitest';
import WebSocket from 'ws';
import type { TestUser } from './api-client.js';
import { TEST_ORIGIN } from './test-env.js';

export interface ReceivedEvent {
  type: string;
  entityType: string;
  entityId: string;
  actorId: string;
}

export interface LiveSubscription {
  events: ReceivedEvent[];
  errors: unknown[];
  completed: boolean;
  /** Waits until an event matches, or fails after `timeoutMs`. */
  waitFor(match: (event: ReceivedEvent) => boolean, timeoutMs?: number): Promise<ReceivedEvent>;
  close(): Promise<void>;
}

/** A WebSocket client that sends the user's cookie and the given Origin, like a browser would. */
function socketClass(cookie: string, origin: string | null) {
  return class extends WebSocket {
    constructor(address: string | URL, protocols?: string | string[]) {
      super(address, protocols, { headers: { ...(cookie && { cookie }), ...(origin && { origin }) } });
    }
  };
}

export function connect(user: TestUser | null, origin: string | null = TEST_ORIGIN): Client {
  const url = inject('apiUrl').replace(/^http/, 'ws') + '/api/graphql';
  return createClient({ url, webSocketImpl: socketClass(user?.cookieHeader() ?? '', origin), retryAttempts: 0, lazy: true });
}

/** Subscribes to a workspace's events and resolves once the server has had time to register it. */
export async function subscribeToWorkspace(user: TestUser | null, workspaceId: string, origin: string | null = TEST_ORIGIN): Promise<LiveSubscription> {
  const client = connect(user, origin);
  const live: LiveSubscription = {
    events: [],
    errors: [],
    completed: false,
    async waitFor(match, timeoutMs = 5_000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const found = live.events.find(match);
        if (found) return found;
        if (live.completed || live.errors.length) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      throw new Error(`No matching event. Got ${JSON.stringify(live.events)}, errors ${JSON.stringify(live.errors)}`);
    },
    close: async () => {
      await client.dispose();
    },
  };
  client.subscribe<{ workspaceEvents: ReceivedEvent }>(
    { query: 'subscription($w: ID!) { workspaceEvents(workspaceId: $w) { type entityType entityId actorId } }', variables: { w: workspaceId } },
    {
      next: (result) => {
        if (result.data) live.events.push(result.data.workspaceEvents);
        if (result.errors) live.errors.push(...result.errors);
      },
      error: (error) => live.errors.push(error),
      complete: () => {
        live.completed = true;
      },
    },
  );
  await new Promise((done) => setTimeout(done, 400));
  return live;
}
