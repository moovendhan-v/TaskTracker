import type { TypedDocumentString } from './generated/graphql.js';
import type { GraphQLFormattedError } from './graphql-error.js';

export interface GraphQLClientOptions {
  /** API origin, e.g. http://localhost:3000. Leave empty to call the same origin. */
  baseUrl?: string;
  /** Called when the server answers UNAUTHENTICATED, e.g. to send the user to sign in. */
  onUnauthenticated?: () => void;
}

export interface RequestOptions {
  /** Cancels the request, e.g. TanStack Query's `signal`. */
  signal?: AbortSignal;
}

export class GraphQLRequestError extends Error {
  constructor(
    readonly errors: readonly GraphQLFormattedError[],
    /** HTTP status of the response; 200 for errors reported inside a successful response. */
    readonly status: number,
  ) {
    super(errors.map((error) => error.message).join('; ') || 'GraphQL request failed');
    this.name = 'GraphQLRequestError';
  }

  /**
   * Per-field validation messages from a BAD_USER_INPUT error (`extensions.fields`),
   * so forms can show each one next to its input. Empty for other errors.
   */
  get fieldErrors(): { field: string; message: string }[] {
    const fields = this.errors[0]?.extensions?.['fields'];
    if (!Array.isArray(fields)) return [];
    return fields.filter(
      (item): item is { field: string; message: string } =>
        !!item && typeof item === 'object' && typeof (item as { field?: unknown }).field === 'string' && typeof (item as { message?: unknown }).message === 'string',
    );
  }

  /** The `extensions.code` of the first error, e.g. FORBIDDEN, NOT_FOUND or BAD_USER_INPUT. */
  get code(): string | undefined {
    const code = this.errors[0]?.extensions?.['code'];
    return typeof code === 'string' ? code : undefined;
  }
}

const OPERATION_NAME = /^\s*(?:query|mutation|subscription)\s+(\w+)/;

/**
 * Typed GraphQL client for the operations in `operations/*.graphql`. Result and
 * variable types come from the document, so a call can't drift from the schema:
 *
 *   const { tasks } = await graphql(TasksDocument, { workspaceId, listId });
 *
 * Sends JSON (which passes the server's CSRF check) with the session cookie and
 * throws GraphQLRequestError when the response carries errors.
 */
export function createGraphQLClient(options: GraphQLClientOptions = {}) {
  const endpoint = `${options.baseUrl ?? ''}/api/graphql`;

  return async function graphql<TResult, TVariables>(
    document: TypedDocumentString<TResult, TVariables>,
    variables: TVariables,
    requestOptions: RequestOptions = {},
  ): Promise<TResult> {
    const query = document.toString();
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/graphql-response+json, application/json' },
      body: JSON.stringify({ query, variables, operationName: OPERATION_NAME.exec(query)?.[1] }),
      signal: requestOptions.signal,
    });
    const body = (await response.json().catch(() => ({}))) as { data?: TResult | null; errors?: GraphQLFormattedError[] };

    if (body.errors?.length) {
      const error = new GraphQLRequestError(body.errors, response.status);
      if (error.code === 'UNAUTHENTICATED') options.onUnauthenticated?.();
      throw error;
    }
    if (!response.ok || body.data == null) {
      throw new GraphQLRequestError([{ message: `Request failed with status ${response.status}` }], response.status);
    }
    return body.data;
  };
}

export type GraphQLClient = ReturnType<typeof createGraphQLClient>;
