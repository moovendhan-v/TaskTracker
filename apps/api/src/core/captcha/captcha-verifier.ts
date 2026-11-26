import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Checks a Cloudflare Turnstile token on the server (AGENTS.md rule 11) for public forms outside
 * Better Auth: the feedback widget and portal. Without a secret (development, tests) there's no
 * CAPTCHA; production requires one (see the env schema). Fails closed: any error is a "no".
 */
@Injectable()
export class CaptchaVerifier {
  private readonly logger = new Logger(CaptchaVerifier.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  get required(): boolean {
    return this.env.TURNSTILE_SECRET_KEY !== undefined;
  }

  get siteKey(): string | null {
    return this.required ? (this.env.TURNSTILE_SITE_KEY ?? null) : null;
  }

  async verify(token: string | null | undefined, ip: string | null): Promise<boolean> {
    if (!this.required) return true;
    if (!token || token.length > 2_048) return false;
    try {
      const body = new URLSearchParams({ secret: this.env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) });
      const response = await fetch(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(5_000) });
      if (!response.ok) return false;
      const result = (await response.json()) as { success?: unknown };
      return result.success === true;
    } catch (error) {
      this.logger.warn(`CAPTCHA check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
