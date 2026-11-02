import { createHmac, timingSafeEqual } from 'node:crypto';

/** What a signed storage URL lets its holder do, until `exp` (ms since epoch). */
export type StorageGrant =
  | { op: 'put'; key: string; max: number; exp: number }
  | { op: 'get'; key: string; type: string; name: string; inline: boolean; exp: number };

/**
 * Short-lived, HMAC-SHA256 signed capabilities for storage URLs. The API issues
 * them only after its own access checks (row-level security), so the URL itself
 * is the permission: it can't be altered, and it expires.
 */
export class StorageTokens {
  private readonly key: Buffer;

  constructor(secret: string) {
    // A key of its own, derived from the app secret, so tokens can't be confused with other signatures.
    this.key = createHmac('sha256', secret).update('taskflow:storage-url:v1').digest();
  }

  sign(grant: StorageGrant): string {
    const payload = Buffer.from(JSON.stringify(grant), 'utf8').toString('base64url');
    return `${payload}.${this.mac(payload)}`;
  }

  /** The grant, or null when the token is malformed, altered or expired. */
  verify(token: string, now = Date.now()): StorageGrant | null {
    if (token.length > 2_000) return null;
    const [payload, mac, ...rest] = token.split('.');
    if (!payload || !mac || rest.length) return null;
    const expected = Buffer.from(this.mac(payload));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const grant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as StorageGrant;
      if (typeof grant.exp !== 'number' || grant.exp < now || typeof grant.key !== 'string') return null;
      if (grant.op !== 'put' && grant.op !== 'get') return null;
      return grant;
    } catch {
      return null;
    }
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}
