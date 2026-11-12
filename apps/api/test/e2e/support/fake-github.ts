import { createPrivateKey, createPublicKey, createVerify, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { E2E_GITHUB_APP, FAKE_GITHUB_PORT, FAKE_GITHUB_URL } from './test-env.js';

interface Installation {
  id: number;
  account: { login: string; type: 'User' | 'Organization' };
  repos: string[];
}

export interface FakePull {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  branch: string;
  updatedAt: string;
}

export interface FakeIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  updatedAt: string;
}

/**
 * A stand-in for GitHub for the GitHub App tests: OAuth codes, the installations a person can
 * reach, app JWTs (checked against the app's key, like GitHub) and installation tokens, and
 * per-repository pull requests and issues. Listens on FAKE_GITHUB_PORT, where the API under
 * test is pointed (GITHUB_API_URL / GITHUB_OAUTH_URL).
 */
export class FakeGithub {
  private server: Server | null = null;
  private readonly publicKey;
  readonly installations = new Map<number, Installation>();
  /** OAuth code → the installations that person can reach. */
  private readonly codes = new Map<string, number[]>();
  private readonly userTokens = new Map<string, number[]>();
  private readonly installationTokens = new Map<string, number>();
  readonly pulls = new Map<string, FakePull[]>();
  readonly issues = new Map<string, FakeIssue[]>();
  /** Every issue change TaskFlow sent: repo#number and the body. */
  readonly patches: { issue: string; body: Record<string, unknown> }[] = [];
  private clock = Date.now();

  constructor(privateKeyBase64: string) {
    this.publicKey = createPublicKey(createPrivateKey(Buffer.from(privateKeyBase64, 'base64').toString()));
  }

  /** A later moment each call, so updated_at always moves forward. */
  now(): string {
    this.clock = Math.max(this.clock + 1000, Date.now());
    return new Date(this.clock).toISOString();
  }

  addInstallation(id: number, login: string, repos: string[]): void {
    this.installations.set(id, { id, account: { login, type: 'Organization' }, repos });
    for (const repo of repos) {
      if (!this.pulls.has(repo)) this.pulls.set(repo, []);
      if (!this.issues.has(repo)) this.issues.set(repo, []);
    }
  }

  /** An OAuth code for someone who can reach these installations. */
  codeFor(installationIds: number[]): string {
    const code = randomBytes(10).toString('hex');
    this.codes.set(code, installationIds);
    return code;
  }

  pull(repo: string, pull: Omit<FakePull, 'updatedAt' | 'merged' | 'state' | 'body' | 'branch'> & Partial<FakePull>): void {
    const list = this.pulls.get(repo)!;
    const existing = list.find((item) => item.number === pull.number);
    const next: FakePull = { body: '', state: 'open', merged: false, branch: 'feature', ...existing, ...pull, updatedAt: this.now() };
    if (existing) Object.assign(existing, next);
    else list.push(next);
  }

  /** A change made on GitHub to an issue. */
  editIssue(repo: string, number: number, change: Partial<Pick<FakeIssue, 'title' | 'state'>>): void {
    Object.assign(this.issues.get(repo)!.find((issue) => issue.number === number)!, change, { updatedAt: this.now() });
  }

  issue(repo: string, number: number): FakeIssue | undefined {
    return this.issues.get(repo)?.find((issue) => issue.number === number);
  }

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        try {
          this.handle(request, response, Buffer.concat(chunks).toString());
        } catch {
          response.writeHead(500).end();
        }
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(FAKE_GITHUB_PORT, '127.0.0.1', resolve));
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
  }

  private handle(request: IncomingMessage, response: ServerResponse, raw: string): void {
    const url = new URL(request.url ?? '/', FAKE_GITHUB_URL);
    const json = (status: number, value: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

    if (request.method === 'POST' && url.pathname === '/login/oauth/access_token') {
      const reach = this.codes.get(String(body['code']));
      if (body['client_id'] !== E2E_GITHUB_APP.clientId || body['client_secret'] !== E2E_GITHUB_APP.clientSecret || !reach) return json(200, { error: 'bad_verification_code' });
      this.codes.delete(String(body['code']));
      const token = `gho_${randomBytes(16).toString('hex')}`;
      this.userTokens.set(token, reach);
      return json(200, { access_token: token, token_type: 'bearer' });
    }
    if (request.method === 'GET' && url.pathname === '/user/installations') {
      const reach = this.userTokens.get(bearer);
      if (!reach) return json(401, {});
      return json(200, { installations: reach.map((id) => this.installations.get(id)).filter(Boolean).map((item) => ({ id: item!.id, account: item!.account })) });
    }
    const tokenFor = /^\/app\/installations\/(\d+)\/access_tokens$/.exec(url.pathname);
    if (request.method === 'POST' && tokenFor) {
      if (!this.appJwtValid(bearer)) return json(401, {});
      const id = Number(tokenFor[1]);
      if (!this.installations.has(id)) return json(404, {});
      const token = `ghs_${randomBytes(16).toString('hex')}`;
      this.installationTokens.set(token, id);
      return json(201, { token, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    }

    const installation = this.installations.get(this.installationTokens.get(bearer) ?? -1);
    if (!installation) return json(401, {});
    if (request.method === 'GET' && url.pathname === '/installation/repositories') {
      return json(200, { total_count: installation.repos.length, repositories: installation.repos.map((full_name) => ({ full_name })) });
    }
    const repoMatch = /^\/repos\/([^/]+)\/([^/]+)(\/.*)$/.exec(url.pathname);
    if (!repoMatch) return json(404, {});
    const repo = `${decodeURIComponent(repoMatch[1]!)}/${decodeURIComponent(repoMatch[2]!)}`;
    if (!installation.repos.includes(repo)) return json(404, {});
    const rest = repoMatch[3]!;
    const html = (kind: string, number: number) => `https://github.com/${repo}/${kind}/${number}`;
    if (request.method === 'GET' && rest === '/pulls') {
      const list = [...this.pulls.get(repo)!].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return json(
        200,
        list.map((pull) => ({
          number: pull.number,
          title: pull.title,
          body: pull.body,
          state: pull.state,
          merged_at: pull.merged ? pull.updatedAt : null,
          html_url: html('pull', pull.number),
          head: { ref: pull.branch },
          user: { login: 'octocat' },
          updated_at: pull.updatedAt,
        })),
      );
    }
    if (request.method === 'GET' && rest === '/issues') {
      const since = url.searchParams.get('since') ?? '';
      const issues = this.issues.get(repo)!.filter((issue) => issue.updatedAt >= since).map((issue) => ({ number: issue.number, title: issue.title, state: issue.state, html_url: html('issues', issue.number), updated_at: issue.updatedAt }));
      // GitHub lists pull requests among issues; TaskFlow must skip them.
      const pulls = this.pulls.get(repo)!.filter((pull) => pull.updatedAt >= since).map((pull) => ({ number: pull.number, title: pull.title, state: pull.state, html_url: html('pull', pull.number), updated_at: pull.updatedAt, pull_request: {} }));
      return json(200, [...issues, ...pulls].sort((a, b) => a.updated_at.localeCompare(b.updated_at)));
    }
    if (request.method === 'POST' && rest === '/issues') {
      const list = this.issues.get(repo)!;
      const number = 100 + list.length + 1;
      list.push({ number, title: String(body['title']), body: String(body['body'] ?? ''), state: 'open', updatedAt: this.now() });
      return json(201, { number, html_url: html('issues', number), title: body['title'], state: 'open' });
    }
    const issueMatch = /^\/issues\/(\d+)$/.exec(rest);
    if (request.method === 'PATCH' && issueMatch) {
      const issue = this.issue(repo, Number(issueMatch[1]));
      if (!issue) return json(404, {});
      this.patches.push({ issue: `${repo}#${issue.number}`, body });
      if (typeof body['title'] === 'string') issue.title = body['title'];
      if (body['state'] === 'open' || body['state'] === 'closed') issue.state = body['state'];
      issue.updatedAt = this.now();
      return json(200, { number: issue.number, html_url: html('issues', issue.number) });
    }
    return json(404, {});
  }

  private appJwtValid(jwt: string): boolean {
    const [header, payload, signature] = jwt.split('.');
    if (!header || !payload || !signature) return false;
    if (!createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(this.publicKey, Buffer.from(signature, 'base64url'))) return false;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { iss?: string; exp?: number };
    return claims.iss === E2E_GITHUB_APP.id && (claims.exp ?? 0) * 1000 > Date.now();
  }
}
