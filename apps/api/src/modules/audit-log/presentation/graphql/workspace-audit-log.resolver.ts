import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { pagedComplexity } from '../../../../core/graphql/page.type.js';
import type { WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { AuditLogService } from '../../application/audit-log.service.js';
import { AuditLogPageGql, WorkspaceAuditArgs } from './audit-log.types.js';

@Resolver(() => AuditLogPageGql)
export class WorkspaceAuditLogResolver {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Query(() => AuditLogPageGql, { complexity: pagedComplexity, description: 'This workspace’s audit log, newest first, without IP addresses' })
  @RequirePermissions('audit.view')
  workspaceAuditLog(@Args() args: WorkspaceAuditArgs, @CurrentAccess() access: WorkspaceAccess): Promise<AuditLogPageGql> {
    return this.auditLogService.forWorkspace(access.workspaceId, {
      action: args.action,
      actorId: args.actorId,
      page: args.page,
      pageSize: args.pageSize,
    });
  }
}
