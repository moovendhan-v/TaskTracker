import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiParam } from '@nestjs/swagger';
import type { Permission } from '@taskflow/shared-types';
import { WorkspaceAccessGuard } from './workspace-access.guard.js';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Requires a `:workspaceId` route param and checks that the caller is a member
 * of that workspace with every listed permission. Pass none to only require membership.
 */
export const RequirePermissions = (...permissions: Permission[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    UseGuards(WorkspaceAccessGuard),
    ApiParam({ name: 'workspaceId', format: 'uuid' }),
    ApiForbiddenResponse({ description: 'Missing workspace permission' }),
  );
