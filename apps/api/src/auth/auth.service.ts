import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { Pool } from 'pg';
import { PLATFORM_ROLES, type PlatformRole } from '@taskflow/shared-types';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { PG_POOL } from '../database/pg-pool.provider.js';
import type { SessionUser } from '../common/http/authenticated-request.js';
import { createAuth, type Auth } from './better-auth.factory.js';
import { ConsoleMailer } from './console-mailer.js';

@Injectable()
export class AuthService {
  readonly auth: Auth;

  constructor(@Inject(ENV) env: Env, @Inject(PG_POOL) pool: Pool) {
    this.auth = createAuth(env, pool, new ConsoleMailer(env.NODE_ENV === 'development'));
  }

  /** Resolves the session from request cookies. Returns null for missing, expired or suspended sessions. */
  async getSessionUser(headers: IncomingHttpHeaders): Promise<SessionUser | null> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) });
    if (!session || session.user.suspended) return null;

    const { user } = session;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image ?? null,
      platformRole: toPlatformRole(user.platformRole),
    };
  }
}

function toPlatformRole(value: unknown): PlatformRole {
  return PLATFORM_ROLES.includes(value as PlatformRole) ? (value as PlatformRole) : 'USER';
}
