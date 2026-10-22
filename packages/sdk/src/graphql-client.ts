import type { GraphQLFormattedError } from './graphql-error.js';

export interface GraphQLClientOptions {
  /** API origin, e.g. http://localhost:3000. Leave empty to call the same origin. */
  baseUrl?: string;
  /** Called on a 401-style UNAUTHENTICATED error, e.g. to redirect to sign-in. */
  onUnauthenticated?: () => void;
}

export class GraphQLRequestError extends Error {
  constructor(readonly errors: readonly GraphQLFormattedError[]) {
    super(errors.map((error) => error.message).join('; ') || 'GraphQL request failed');
    this.name = 'GraphQLRequestError';
  }

  /** The `extensions.code` of the first error, e.g. FORBIDDEN or NOT_FOUND. */
  get code(): string | undefined {
    const code = this.errors[0]?.extensions?.['code'];
    return typeof code === 'string' ? code : undefined;
  }
}

/**
 * Minimal typed GraphQL client. Sends JSON (which satisfies the server's CSRF
 * check) with the session cookie, and throws GraphQLRequestError on errors.
 *
 *   const data = await graphql<{ me: CurrentUser }>(`{ me { id name } }`);
 */
export function createGraphQLClient(options: GraphQLClientOptions = {}) {
  const endpoint = `${options.baseUrl ?? ''}/api/graphql`;

  return async function graphql<TData, TVariables extends Record<string, unknown> = Record<string, never>>(
    query: string,
    variables?: TVariables,
  ): Promise<TData> {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json().catch(() => ({}))) as { data?: TData | null; errors?: GraphQLFormattedError[] };
    if (body.errors?.length) {
      const error = new GraphQLRequestError(body.errors);
      if (error.code === 'UNAUTHENTICATED') options.onUnauthenticated?.();
      throw error;
    }
    if (!response.ok || body.data == null) throw new GraphQLRequestError([{ message: `Request failed with status ${response.status}` }]);
    return body.data;
  };
}
