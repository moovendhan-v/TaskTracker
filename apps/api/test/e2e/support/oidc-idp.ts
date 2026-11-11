import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';

/** Where the test identity provider listens; the API under test trusts this origin (SSO_TRUSTED_ISSUERS). */
export const OIDC_IDP_PORT = 7790;
export const OIDC_IDP_ISSUER = `http://127.0.0.1:${OIDC_IDP_PORT}`;
export const OIDC_CLIENT_ID = 'taskflow-e2e';
export const OIDC_CLIENT_SECRET = 'e2e-client-secret-0123456789';

export interface IdpUser {
  sub: string;
  email: string;
  name: string;
}

interface Grant {
  user: IdpUser;
  nonce: string | null;
  redirectUri: string;
  clientId: string;
}

/**
 * A small OpenID Connect provider for the SSO tests: discovery, signing keys, an authorize
 * endpoint that signs in whoever `signInAs` names, a token endpoint and userinfo. ID tokens
 * are RS256-signed with a key made at start-up, like a real provider's.
 */
export class TestOidcProvider {
  private server: Server | null = null;
  private key: { privateKey: CryptoKey; jwk: JWK } | null = null;
  private readonly grants = new Map<string, Grant>();
  private readonly tokens = new Map<string, IdpUser>();
  /** Who the next authorize request signs in. */
  signInAs: IdpUser = { sub: 'idp-user-1', email: 'someone@example.com', name: 'Someone' };

  async start(): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    this.key = { privateKey, jwk: { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' } };
    this.server = createServer((request, response) => {
      void this.handle(request).then(
        ({ status, headers, body }) => {
          response.writeHead(status, headers);
          response.end(body);
        },
        () => {
          response.writeHead(500);
          response.end();
        },
      );
    });
    await new Promise<void>((resolve) => this.server!.listen(OIDC_IDP_PORT, '127.0.0.1', resolve));
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
  }

  private async handle(request: IncomingMessage): Promise<{ status: number; headers: Record<string, string>; body?: string }> {
    const url = new URL(request.url ?? '/', OIDC_IDP_ISSUER);
    const json = (status: number, value: unknown) => ({ status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    switch (url.pathname) {
      case '/.well-known/openid-configuration':
        return json(200, {
          issuer: OIDC_IDP_ISSUER,
          authorization_endpoint: `${OIDC_IDP_ISSUER}/authorize`,
          token_endpoint: `${OIDC_IDP_ISSUER}/token`,
          userinfo_endpoint: `${OIDC_IDP_ISSUER}/userinfo`,
          jwks_uri: `${OIDC_IDP_ISSUER}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          scopes_supported: ['openid', 'email', 'profile'],
          token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
          code_challenge_methods_supported: ['S256'],
          grant_types_supported: ['authorization_code'],
        });
      case '/jwks':
        return json(200, { keys: [this.key!.jwk] });
      case '/authorize': {
        const redirectUri = url.searchParams.get('redirect_uri');
        const clientId = url.searchParams.get('client_id');
        if (!redirectUri || clientId !== OIDC_CLIENT_ID) return json(400, { error: 'invalid_request' });
        const code = randomBytes(16).toString('hex');
        this.grants.set(code, { user: this.signInAs, nonce: url.searchParams.get('nonce'), redirectUri, clientId });
        const back = new URL(redirectUri);
        back.searchParams.set('code', code);
        const state = url.searchParams.get('state');
        if (state) back.searchParams.set('state', state);
        return { status: 302, headers: { Location: back.toString() } };
      }
      case '/token': {
        const form = new URLSearchParams(await readBody(request));
        const basic = /^Basic (.+)$/.exec(request.headers.authorization ?? '')?.[1];
        const [basicId, basicSecret] = basic ? Buffer.from(basic, 'base64').toString().split(':').map(decodeURIComponent) : [];
        const clientId = basicId ?? form.get('client_id');
        const clientSecret = basicSecret ?? form.get('client_secret');
        if (clientId !== OIDC_CLIENT_ID || clientSecret !== OIDC_CLIENT_SECRET) return json(401, { error: 'invalid_client' });
        const grant = this.grants.get(form.get('code') ?? '');
        this.grants.delete(form.get('code') ?? '');
        if (!grant || grant.redirectUri !== form.get('redirect_uri')) return json(400, { error: 'invalid_grant' });
        const accessToken = randomBytes(16).toString('hex');
        this.tokens.set(accessToken, grant.user);
        const idToken = await new SignJWT({ email: grant.user.email, email_verified: true, name: grant.user.name, ...(grant.nonce ? { nonce: grant.nonce } : {}) })
          .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
          .setIssuer(OIDC_IDP_ISSUER)
          .setSubject(grant.user.sub)
          .setAudience(OIDC_CLIENT_ID)
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(this.key!.privateKey);
        return json(200, { access_token: accessToken, token_type: 'Bearer', expires_in: 300, id_token: idToken, scope: 'openid email profile' });
      }
      case '/userinfo': {
        const user = this.tokens.get(/^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '');
        if (!user) return json(401, { error: 'invalid_token' });
        return json(200, { sub: user.sub, email: user.email, email_verified: true, name: user.name });
      }
      default:
        return json(404, { error: 'not_found' });
    }
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString()));
    request.on('error', reject);
  });
}
