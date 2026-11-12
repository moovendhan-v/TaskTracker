import { Inject, Injectable } from '@nestjs/common';
import type { KeyObject } from 'node:crypto';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { githubAppJwt, readGithubAppPrivateKey } from './github-app-credentials.js';

/** GitHub calls give up after this long. */
const TIMEOUT_MS = 10_000;
/** Larger responses are refused rather than read. */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
/** Installation tokens last an hour; a new one is fetched this long before that. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

export type GithubMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** A GitHub call that failed. The message is ours, never GitHub's response text. */
export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Seconds GitHub asked us to wait (rate limits), when it said. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'GithubApiError';
  }

  get rateLimited(): boolean {
    return this.status === 429 || (this.status === 403 && this.retryAfter !== null);
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Talks to GitHub as the TaskFlow GitHub App (E2). The app signs in with a short-lived JWT
 * made from its private key; work on a repository uses an installation token, fetched when
 * needed and kept only in memory until shortly before it expires. Tokens are never stored or
 * logged. Every call has a timeout and a size limit, goes only to GitHub's API, and returns
 * untrusted JSON for the caller to check.
 */
@Injectable()
export class GithubAppClient {
  private readonly key: KeyObject | null;
  private readonly appId: string | null;
  private readonly base: URL;
  private readonly tokens = new Map<number, CachedToken>();
  private readonly pending = new Map<number, Promise<CachedToken>>();

  constructor(@Inject(ENV) env: Env) {
    this.appId = env.GITHUB_APP_ID ?? null;
    this.key = env.GITHUB_APP_PRIVATE_KEY ? readGithubAppPrivateKey(env.GITHUB_APP_PRIVATE_KEY) : null;
    this.base = new URL(env.GITHUB_API_URL);
  }

  /** Whether the app is set up (GITHUB_APP_* in the environment). */
  get enabled(): boolean {
    return this.key !== null && this.appId !== null;
  }

  /** A call as the app itself (installations, the app's own settings). */
  asApp(method: GithubMethod, path: string, body?: unknown): Promise<unknown> {
    return this.send(this.appJwt(), method, path, body);
  }

  /** A call as one installation (its repositories), with an installation token. */
  async asInstallation(installationId: number, method: GithubMethod, path: string, body?: unknown): Promise<unknown> {
    const token = await this.installationToken(installationId);
    try {
      return await this.send(token, method, path, body);
    } catch (error) {
      // A token revoked early (app reinstalled, permissions changed): one retry with a new one.
      if (!(error instanceof GithubApiError) || error.status !== 401) throw error;
      this.tokens.delete(installationId);
      return this.send(await this.installationToken(installationId), method, path, body);
    }
  }

  /** A call with a person's own GitHub token (from the install sign-in). */
  asUser(token: string, method: GithubMethod, path: string, body?: unknown): Promise<unknown> {
    return this.send(token, method, path, body);
  }

  /** Forgets an installation's token (uninstalled or suspended). */
  forget(installationId: number): void {
    this.tokens.delete(installationId);
  }

  private appJwt(): string {
    if (!this.key || !this.appId) throw new GithubApiError(0, 'The GitHub App isn’t set up');
    return githubAppJwt(this.appId, this.key);
  }

  private async installationToken(installationId: number): Promise<string> {
    if (!Number.isSafeInteger(installationId) || installationId < 1) throw new GithubApiError(0, 'Not a GitHub installation');
    const cached = this.tokens.get(installationId);
    if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) return cached.token;
    // Calls at the same moment share one token request.
    let request = this.pending.get(installationId);
    if (!request) {
      request = this.fetchToken(installationId).finally(() => this.pending.delete(installationId));
      this.pending.set(installationId, request);
    }
    return (await request).token;
  }

  private async fetchToken(installationId: number): Promise<CachedToken> {
    const response = (await this.send(this.appJwt(), 'POST', `/app/installations/${installationId}/access_tokens`)) as { token?: unknown; expires_at?: unknown } | null;
    const token = typeof response?.token === 'string' && /^[A-Za-z0-9_]{20,255}$/.test(response.token) ? response.token : null;
    const expiresAt = typeof response?.expires_at === 'string' ? Date.parse(response.expires_at) : NaN;
    if (!token || !Number.isFinite(expiresAt)) throw new GithubApiError(502, 'GitHub sent an unreadable installation token');
    const entry = { token, expiresAt };
    this.tokens.set(installationId, entry);
    return entry;
  }

  private async send(token: string, method: GithubMethod, path: string, body?: unknown): Promise<unknown> {
    // Paths are ours, built from checked numbers and names; the result must still be GitHub's API.
    const url = new URL(path, this.base);
    if (!path.startsWith('/') || path.startsWith('//') || url.origin !== this.base.origin) throw new GithubApiError(0, 'Not a GitHub API path');
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'TaskFlow',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new GithubApiError(504, 'GitHub didn’t answer in time');
    }
    const text = await readLimited(response);
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after') ?? (response.headers.get('x-ratelimit-remaining') === '0' ? '60' : NaN));
      throw new GithubApiError(response.status, `GitHub answered ${response.status}`, Number.isFinite(retryAfter) ? retryAfter : null);
    }
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new GithubApiError(502, 'GitHub sent something that isn’t JSON');
    }
  }
}

async function readLimited(response: Response): Promise<string> {
  if (Number(response.headers.get('content-length') ?? 0) > MAX_RESPONSE_BYTES) throw new GithubApiError(502, 'GitHub’s answer was too large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new GithubApiError(502, 'GitHub’s answer was too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
