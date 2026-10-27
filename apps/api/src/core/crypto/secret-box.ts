import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';

const VERSION = 'v1';

/**
 * Encrypts small secrets for storage (AES-256-GCM, a fresh IV each time), such
 * as webhook secrets that must be read back to check signatures. The key is
 * derived from BETTER_AUTH_SECRET with HKDF, so it never sits in the database;
 * rotating that secret means re-creating the secrets stored with it.
 */
@Injectable()
export class SecretBox {
  private readonly key: Buffer;

  constructor(@Inject(ENV) env: Env) {
    this.key = Buffer.from(hkdfSync('sha256', env.BETTER_AUTH_SECRET, 'taskflow', 'taskflow:secret-box:v1', 32));
  }

  seal(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
  }

  /** Throws when the value was tampered with or sealed with another key. */
  open(sealed: string): string {
    const [version, iv, tag, data] = sealed.split('.');
    if (version !== VERSION || !iv || !tag || !data) throw new Error('Unreadable sealed value');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}
