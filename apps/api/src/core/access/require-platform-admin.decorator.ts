import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard.js';

export const REQUIRES_PLATFORM_ADMIN_KEY = 'requiresPlatformAdmin';

/** Limits a resolver or operation to SUPER_ADMIN users. Its database work runs with cross-workspace access. */
export const RequirePlatformAdmin = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(REQUIRES_PLATFORM_ADMIN_KEY, true), UseGuards(PlatformAdminGuard));
