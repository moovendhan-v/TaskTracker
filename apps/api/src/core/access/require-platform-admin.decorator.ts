import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiNotFoundResponse } from '@nestjs/swagger';
import { PlatformAdminGuard } from './platform-admin.guard.js';

/** Limits a controller or route to SUPER_ADMIN users. */
export const RequirePlatformAdmin = (): MethodDecorator & ClassDecorator =>
  applyDecorators(UseGuards(PlatformAdminGuard), ApiNotFoundResponse({ description: 'Not a platform admin' }));
