import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';

/**
 * Reads GITHUB_APP_PRIVATE_KEY: the .pem GitHub gave, either base64-encoded on one line
 * (`base64 -w0 key.pem`) or as the PEM text with `\n` for line breaks. Throws when it isn't
 * an RSA private key.
 */
export function readGithubAppPrivateKey(value: string): KeyObject {
  const trimmed = value.trim();
  const pem = trimmed.includes('-----BEGIN') ? trimmed.replace(/\\n/g, '\n') : Buffer.from(trimmed, 'base64').toString('utf8');
  if (!pem.includes('-----BEGIN')) throw new Error('GITHUB_APP_PRIVATE_KEY is neither a PEM key nor a base64-encoded one');
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== 'rsa') throw new Error('GITHUB_APP_PRIVATE_KEY must be the RSA key GitHub generated');
  return key;
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/**
 * A short-lived JWT that authenticates as the GitHub App itself (RS256, as GitHub requires).
 * Issued a minute in the past to allow for clock drift; GitHub accepts at most ten minutes.
 */
export function githubAppJwt(appId: string, key: KeyObject, now = Date.now()): string {
  const seconds = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: seconds - 60, exp: seconds + 9 * 60, iss: appId }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key);
  return `${header}.${payload}.${base64url(signature)}`;
}
