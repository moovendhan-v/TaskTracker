import { ForbiddenException, NotFoundException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import type { AccessService } from './access.service.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

vi.mock('../http/request-context.js', () => ({ getRequest: (context: { user: unknown }) => ({ user: context.user }) }));

const contextFor = (user: unknown) => ({ user }) as unknown as ExecutionContext;
const guard = (required: boolean, hasTwoStep: boolean) =>
  new PlatformAdminGuard({ hasTwoStep: async () => hasTwoStep } as unknown as AccessService, { PLATFORM_ADMIN_REQUIRE_TWO_STEP: required } as Env);

describe('PlatformAdminGuard', () => {
  it('hides the admin console from everyone but super admins', async () => {
    await expect(guard(false, true).canActivate(contextFor({ id: 'u', platformRole: 'USER' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(guard(false, false).canActivate(contextFor(undefined))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('asks super admins for two-step sign-in when required (production default)', async () => {
    const admin = contextFor({ id: 'a', platformRole: 'SUPER_ADMIN' });
    await expect(guard(true, false).canActivate(admin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard(true, true).canActivate(admin)).resolves.toBe(true);
    await expect(guard(false, false).canActivate(admin)).resolves.toBe(true);
  });
});
