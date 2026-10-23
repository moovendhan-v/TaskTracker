import { createClient, type Client } from 'graphql-ws';
import type { TypedDocumentString } from './generated/graphql.js';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

export interface RealtimeClientOptions {
  /** Absolute ws(s):// URL. Defaults to /api/graphql on the page's own origin. */
  url?: string;
  onStatus?: (status: RealtimeStatus) => void;
}

export interface Subscription<TResult> {
  next: (data: TResult) => void;
  error?: (error: unknown) => void;
}

function sameOriginUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/api/graphql`;
}

/**
 * GraphQL subscriptions over WebSocket (graphql-ws). The browser sends the
 * session cookie on the handshake. Connects on first use, keeps the socket alive
 * with pings and reconnects with backoff; `onStatus` reports the state.
 */
export function createRealtimeClient(options: RealtimeClientOptions = {}) {
  const client: Client = createClient({
    url: options.url ?? sameOriginUrl(),
    lazy: true,
    keepAlive: 20_000,
    retryAttempts: Infinity,
    shouldRetry: () => true,
    retryWait: async (retries) => {
      const delay = Math.min(1_000 * 2 ** retries, 30_000);
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 1_000));
    },
    on: {
      connecting: () => options.onStatus?.('connecting'),
      connected: () => options.onStatus?.('live'),
      closed: () => options.onStatus?.('offline'),
    },
  });

  return {
    /** Starts a typed subscription and returns a function that stops it. */
    subscribe<TResult, TVariables>(document: TypedDocumentString<TResult, TVariables>, variables: TVariables, sink: Subscription<TResult>): () => void {
      return client.subscribe<TResult>(
        { query: document.toString(), variables: variables as Record<string, unknown> },
        {
          next: (result) => {
            if (result.data) sink.next(result.data);
            if (result.errors?.length) sink.error?.(result.errors);
          },
          error: (error) => sink.error?.(error),
          complete: () => undefined,
        },
      );
    },
    dispose: () => client.dispose(),
  };
}

export type RealtimeClient = ReturnType<typeof createRealtimeClient>;
