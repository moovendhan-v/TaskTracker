import { randomInt, randomUUID } from 'node:crypto';
import { inject } from 'vitest';
import { CONFIRM_EMAIL_SUBJECT, waitForMessageTo } from './mailbox.js';
import { TEST_ORIGIN } from './test-env.js';

export const PASSWORD = 'correct-horse-42';

export interface GraphQLError {
  message: string;
  extensions?: { code?: string };
}

export interface GraphQLResponse<T> {
  status: number;
  data: T | null;
  errors: GraphQLError[] | undefined;
}

/** A random private address, so each user gets its own per-IP rate limit bucket. */
function randomIp(): string {
  return `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
}

export function uniqueEmail(name: string): string {
  const local = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'user';
  return `${local}+${randomUUID().slice(0, 8)}@example.com`;
}

/** One browser-like user: keeps the session cookie and sends GraphQL as JSON. */
export class TestUser {
  readonly baseUrl = inject('apiUrl');
  private cookies = new Map<string, string>();
  id = '';

  constructor(
    readonly name: string,
    readonly email = uniqueEmail(name),
    readonly ip = randomIp(),
  ) {}

  /** Signs up and, unless told otherwise, confirms the email through the link in the sign-up email. */
  static async signUp(name: string, { confirmEmail = true } = {}): Promise<TestUser> {
    const user = new TestUser(name);
    const response = await user.auth('sign-up/email', { name, email: user.email, password: PASSWORD, callbackURL: '/' });
    if (!response.ok) throw new Error(`Sign-up failed with ${response.status}: ${await response.text()}`);
    user.id = (await user.data<{ me: { id: string } }>('{ me { id } }')).me.id;
    if (confirmEmail) await user.confirmEmail();
    return user;
  }

  /** Follows the confirmation link from the sign-up email, as the person would from their inbox. */
  async confirmEmail(): Promise<void> {
    const message = await waitForMessageTo(this.email, CONFIRM_EMAIL_SUBJECT);
    const link = /https?:\/\/\S+\/api\/auth\/verify-email\S+/.exec(message)?.[0];
    if (!link) throw new Error(`No confirmation link in the email to ${this.email}`);
    const response = await fetch(link, { redirect: 'manual', headers: { 'X-Forwarded-For': this.ip } });
    if (response.status !== 302) throw new Error(`Confirming ${this.email} failed with ${response.status}`);
  }

  /** Calls a Better Auth endpoint the way the web app does (same-origin JSON with an Origin header). */
  async auth(path: string, body: unknown): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/api/auth/${path}`, {
      method: 'POST',
      headers: { ...this.headers(), Origin: TEST_ORIGIN },
      body: JSON.stringify(body),
    });
    this.keepCookies(response);
    return response;
  }

  async gql<T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}): Promise<GraphQLResponse<T>> {
    const response = await fetch(`${this.baseUrl}/api/graphql`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json()) as { data?: T | null; errors?: GraphQLError[] };
    return { status: response.status, data: body.data ?? null, errors: body.errors };
  }

  /** Runs an operation that must succeed and returns its data. */
  async data<T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const result = await this.gql<T>(query, variables);
    if (result.errors?.length || !result.data) throw new Error(`Expected success, got: ${JSON.stringify(result.errors)}`);
    return result.data;
  }

  /** Runs an operation that must fail and returns its first error. */
  async error(query: string, variables: Record<string, unknown> = {}): Promise<{ code: string | undefined; message: string }> {
    const result = await this.gql(query, variables);
    const error = result.errors?.[0];
    if (!error) throw new Error(`Expected an error, got: ${JSON.stringify(result.data)}`);
    return { code: error.extensions?.code, message: error.message };
  }

  signOut(): void {
    this.cookies.clear();
  }

  private headers(): Record<string, string> {
    const cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    return { 'Content-Type': 'application/json', 'X-Forwarded-For': this.ip, ...(cookie && { Cookie: cookie }) };
  }

  private keepCookies(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const index = pair?.indexOf('=') ?? -1;
      if (!pair || index < 1) continue;
      const value = pair.slice(index + 1);
      if (value) this.cookies.set(pair.slice(0, index), value);
      else this.cookies.delete(pair.slice(0, index));
    }
  }
}

/** Sends a raw HTTP request to the GraphQL endpoint, for tests that need to break the protocol. */
export function rawGraphql(init: RequestInit): Promise<Response> {
  return fetch(`${inject('apiUrl')}/api/graphql`, init);
}
