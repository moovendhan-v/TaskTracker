import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { components, paths } from './generated/schema.js';

export type TaskFlowClient = Client<paths>;
export type Schemas = components['schemas'];

export interface TaskFlowClientOptions {
  /** API origin, e.g. http://localhost:3000. Leave empty to call the same origin. */
  baseUrl?: string;
  /** Called with every non-2xx response, e.g. to redirect to sign-in on 401. */
  onError?: (response: Response) => void;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(ApiError.messageFrom(status, body));
    this.name = 'ApiError';
  }

  private static messageFrom(status: number, body: unknown): string {
    if (body && typeof body === 'object' && 'message' in body) {
      const { message } = body as { message: unknown };
      if (Array.isArray(message)) return message.join(', ');
      if (typeof message === 'string') return message;
    }
    return `Request failed with status ${status}`;
  }
}

/** Typed client generated from the API's OpenAPI document. Sends the session cookie. */
export function createTaskFlowClient(options: TaskFlowClientOptions = {}): TaskFlowClient {
  const client = createClient<paths>({ baseUrl: options.baseUrl ?? '', credentials: 'include' });
  if (options.onError) {
    const onError = options.onError;
    const errorMiddleware: Middleware = {
      onResponse({ response }) {
        if (!response.ok) onError(response);
      },
    };
    client.use(errorMiddleware);
  }
  return client;
}

/** Unwraps an openapi-fetch result, throwing ApiError for error responses. */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) throw new ApiError(response.status, error);
  return data as T;
}
