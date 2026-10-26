import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { pagedComplexity } from '../../../../core/graphql/page.type.js';
import { resourceQueryComplexity } from '../../../../core/graphql/resource-query.types.js';
import type { NormalizedQuery } from '../../../../core/query/normalize-query.js';
import { ResourceQueryArg, ValidatedQuery } from '../../../../core/query/resource-query.decorator.js';
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

  @Query(() => AuditLogPageGql, { complexity: resourceQueryComplexity, description: 'Audit entries matching filters; see resourceSchema(resource: "audit_log")' })
  @RequirePermissions('audit.view')
  searchWorkspaceAuditLog(
    @WorkspaceIdArg() _workspaceId: string,
    @ResourceQueryArg() _query: unknown,
    @ValidatedQuery('audit_log') query: NormalizedQuery,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AuditLogPageGql> {
    return this.auditLogService.searchWorkspace(access.workspaceId, query);
  }
}
