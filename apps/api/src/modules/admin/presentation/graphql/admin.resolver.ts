import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { RequirePlatformAdmin } from '../../../../core/access/require-platform-admin.decorator.js';
import { pagedComplexity } from '../../../../core/graphql/page.type.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor } from '../../../../core/http/types/authenticated-request.js';
import { AuditLogService } from '../../../audit-log/application/audit-log.service.js';
import { AuditLogPageGql } from '../../../audit-log/presentation/graphql/audit-log.types.js';
import { AdminUsersService } from '../../application/admin-users.service.js';
import { AdminWorkspacesService } from '../../application/admin-workspaces.service.js';
import { AdminAuditArgs, AdminSearchArgs, AdminUserGql, AdminUserPageGql, AdminWorkspacePageGql, UpdateAdminUserInput } from './admin.types.js';

/** SUPER_ADMIN only; everyone else gets NOT_FOUND. */
@Resolver()
@RequirePlatformAdmin()
export class AdminResolver {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminWorkspacesService: AdminWorkspacesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Query(() => AdminUserPageGql, { complexity: pagedComplexity })
  adminUsers(@Args() args: AdminSearchArgs): Promise<AdminUserPageGql> {
    return this.adminUsersService.list(args);
  }

  @Mutation(() => AdminUserGql, { description: 'Suspending signs the user out everywhere. You cannot change your own account.' })
  updateAdminUser(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('input') input: UpdateAdminUserInput,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUserGql> {
    return this.adminUsersService.update(actor, userId, input);
  }

  @Query(() => AdminWorkspacePageGql, { complexity: pagedComplexity })
  adminWorkspaces(@Args() args: AdminSearchArgs): Promise<AdminWorkspacePageGql> {
    return this.adminWorkspacesService.list(args);
  }

  @Query(() => AuditLogPageGql, { complexity: pagedComplexity, description: 'Platform-wide audit log with IP addresses' })
  adminAuditLog(@Args() args: AdminAuditArgs): Promise<AuditLogPageGql> {
    return this.auditLogService.forPlatform(args);
  }
}
