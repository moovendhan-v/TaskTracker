import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { PASSWORD, TestUser } from './support/api-client.js';
import { runtimeDatabase } from './support/database.js';
import { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_IDP_ISSUER, TestOidcProvider } from './support/oidc-idp.js';
import { totp } from './support/totp.js';

const CREATE_ORG = 'mutation($n: String!) { createOrganization(name: $n) { id } }';
const ADD = 'mutation($o: ID!, $e: String!, $r: String!) { addOrganizationMember(organizationId: $o, email: $e, role: $r) { userId } }';
const SSO = 'query($o: ID!) { organizationSso(organizationId: $o) { domain issuer clientId verified dnsRecord { name value } } }';
const SET = 'mutation($o: ID!, $input: OrganizationSsoInput!) { setOrganizationSso(organizationId: $o, input: $input) { domain issuer clientId verified dnsRecord { name value } } }';
const VERIFY = 'mutation($o: ID!) { verifyOrganizationSsoDomain(organizationId: $o) { verified } }';
const REMOVE = 'mutation($o: ID!) { removeOrganizationSso(organizationId: $o) }';
const MY_ORGS = '{ organizations { id role } }';
const ME = '{ me { id email } }';

interface Sso {
  domain: string;
  issuer: string;
  clientId: string;
  verified: boolean;
  dnsRecord: { name: string; value: string } | null;
}

async function turnOnTwoStep(user: TestUser): Promise<void> {
  const { totpURI } = (await (await user.auth('two-factor/enable', { password: PASSWORD })).json()) as { totpURI: string };
  expect((await user.auth('two-factor/verify-totp', { code: totp(new URL(totpURI).searchParams.get('secret')!) })).status).toBe(200);
}

/**
 * Signs a browser in through SSO: TaskFlow → identity provider → TaskFlow's callback.
 * Returns where TaskFlow sent the browser at the end.
 */
async function signInWithSso(browser: TestUser, email: string): Promise<string> {
  const start = await browser.auth('sign-in/sso', { email, callbackURL: '/' });
  if (start.status !== 200) return `refused:${start.status}:${await start.text()}`;
  const { url } = (await start.json()) as { url: string };
  const atIdp = await browser.visit(url);
  const callback = atIdp.headers.get('location')!;
  const done = await browser.visit(callback);
  return done.headers.get('location') ?? `status:${done.status}`;
}

/** A4: SSO (OIDC) per organization, through its own identity provider. */
describe('organization SSO', () => {
  const idp = new TestOidcProvider();
  const domain = `sso-${randomUUID().slice(0, 8)}.example`;
  let owner: TestUser;
  let admin: TestUser;
  let o: string;

  beforeAll(async () => {
    await idp.start();
    owner = await TestUser.signUp('SSO owner');
    admin = await TestUser.signUp('SSO admin');
    o = (await owner.data<{ createOrganization: { id: string } }>(CREATE_ORG, { n: 'SSO org' })).createOrganization.id;
    await owner.data(ADD, { o, e: admin.email, r: 'admin' });
  });

  afterAll(async () => {
    await idp.stop();
  });

  const input = (overrides: Partial<{ domain: string; issuer: string; clientId: string; clientSecret: string }> = {}) => ({
    domain,
    issuer: OIDC_IDP_ISSUER,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    ...overrides,
  });

  it('is set up only by owners with two-step sign-in, for identity providers the server allows', async () => {
    expect((await admin.error(SET, { o, input: input() })).code).toBe('FORBIDDEN');
    expect((await owner.error(SET, { o, input: input() })).message).toMatch(/two-step sign-in/);
    await turnOnTwoStep(owner);
    expect((await owner.error(SET, { o, input: input({ issuer: 'https://evil.example.com' }) })).message).toMatch(/doesn’t allow that identity provider/);
    expect((await owner.error(SET, { o, input: input({ domain: 'not a domain' }) })).message).toMatch(/email domain/);

    const sso = (await owner.data<{ setOrganizationSso: Sso }>(SET, { o, input: input() })).setOrganizationSso;
    expect(sso).toMatchObject({ domain, issuer: OIDC_IDP_ISSUER, clientId: OIDC_CLIENT_ID, verified: false });
    expect(sso.dnsRecord?.name).toBe(`_better-auth-token-org-${o}.${domain}`);
    expect(sso.dnsRecord?.value.length).toBeGreaterThan(10);
    // Admins see it too (never the secret); other people don't.
    expect((await admin.data<{ organizationSso: Sso }>(SSO, { o })).organizationSso.domain).toBe(domain);
    expect(JSON.stringify(await admin.data(SSO, { o }))).not.toContain(OIDC_CLIENT_SECRET);
    const stranger = await TestUser.signUp('SSO stranger');
    expect((await stranger.error(SSO, { o })).code).toBe('NOT_FOUND');
  });

  it("keeps Better Auth's own SSO management and SAML closed to browsers", async () => {
    const response = await admin.auth('sso/register', { providerId: 'sneaky', issuer: OIDC_IDP_ISSUER, domain: 'gmail.com', oidcConfig: { clientId: 'x', clientSecret: 'y' } });
    expect(response.status).toBe(403);
    expect((await admin.auth('sso/verify-domain', { providerId: `org-${o}` })).status).toBe(403);
    expect((await admin.visit(`${inject('apiUrl')}/api/auth/sso/saml2/sp/metadata?providerId=org-${o}`)).status).toBe(403);
  });

  it('works only once the domain is proved', async () => {
    const before = new TestUser('Before proof', `before@${domain}`);
    expect(await signInWithSso(before, before.email)).toMatch(/refused:401|error=/);
    // DNS has no such record in the tests, so checking fails…
    expect((await owner.error(VERIFY, { o })).message).toBeTruthy();
    // …so the record is marked proved in the database, as a successful DNS check would.
    const pool = runtimeDatabase();
    await pool.query(`UPDATE "ssoProvider" SET "domainVerified" = true WHERE "providerId" = $1`, [`org-${o}`]);
    await pool.end();
    expect((await owner.data<{ organizationSso: Sso }>(SSO, { o })).organizationSso).toMatchObject({ verified: true, dnsRecord: null });
  });

  it('signs people in through the identity provider and adds them to the organization', async () => {
    const browser = new TestUser('New hire', `newhire@${domain}`);
    idp.signInAs = { sub: 'idp-newhire', email: browser.email, name: 'New Hire' };
    expect(await signInWithSso(browser, browser.email)).not.toMatch(/error=|refused/);
    const me = (await browser.data<{ me: { id: string; email: string } }>(ME)).me;
    expect(me.email).toBe(browser.email);
    expect((await browser.data<{ organizations: { id: string; role: string }[] }>(MY_ORGS)).organizations).toContainEqual({ id: o, role: 'member' });
  });

  it('links an existing confirmed account with the same email, never an unconfirmed one', async () => {
    const existing = new TestUser('Existing', `existing@${domain}`);
    // Signed up with a password first (and confirmed it).
    await existing.auth('sign-up/email', { name: 'Existing', email: existing.email, password: PASSWORD, callbackURL: '/' });
    await existing.confirmEmail();
    const id = (await existing.data<{ me: { id: string } }>(ME)).me.id;
    const sso = new TestUser('Existing via SSO', existing.email);
    idp.signInAs = { sub: 'idp-existing', email: existing.email, name: 'Existing' };
    expect(await signInWithSso(sso, existing.email)).not.toMatch(/error=|refused/);
    expect((await sso.data<{ me: { id: string } }>(ME)).me.id).toBe(id);

    // Someone registered this address first and never confirmed it: SSO won't hand them that account.
    const squatter = new TestUser('Squatter', `ceo@${domain}`);
    await squatter.auth('sign-up/email', { name: 'Squatter', email: squatter.email, password: PASSWORD, callbackURL: '/' });
    const ceo = new TestUser('CEO via SSO', squatter.email);
    idp.signInAs = { sub: 'idp-ceo', email: squatter.email, name: 'CEO' };
    expect(await signInWithSso(ceo, squatter.email)).toMatch(/error=SSO_ACCOUNT_UNCONFIRMED/);
    expect((await ceo.gql<{ me: unknown }>(ME)).data?.me ?? null).toBeNull();
  });

  it('refuses an identity outside the domain, even from the right provider', async () => {
    const browser = new TestUser('Outsider', `someone@${domain}`);
    idp.signInAs = { sub: 'idp-outsider', email: 'eve@elsewhere.example', name: 'Eve' };
    expect(await signInWithSso(browser, browser.email)).toMatch(/error=SSO_EMAIL_OUTSIDE_DOMAIN/);
    expect((await browser.gql<{ me: unknown }>(ME)).data?.me ?? null).toBeNull();
  });

  it('can be removed by owners, and sign-in through it stops', async () => {
    expect((await admin.error(REMOVE, { o })).code).toBe('FORBIDDEN');
    expect((await owner.data<{ removeOrganizationSso: boolean }>(REMOVE, { o })).removeOrganizationSso).toBe(true);
    expect((await owner.data<{ organizationSso: Sso | null }>(SSO, { o })).organizationSso).toBeNull();
    const browser = new TestUser('After removal', `after@${domain}`);
    expect(await signInWithSso(browser, browser.email)).toMatch(/refused/);
  });
});
