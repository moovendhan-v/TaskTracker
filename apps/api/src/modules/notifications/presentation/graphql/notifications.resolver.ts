import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { pagedComplexity } from '../../../../core/graphql/page.type.js';
import { CurrentUser } from '../../../../core/http/decorators/current-user.decorator.js';
import type { SessionUser, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { NotificationsService } from '../../application/notifications.service.js';
import { InboxArgs, MarkReadArgs, NotificationPageGql } from './notification.types.js';

/** Membership is enough: everyone has an inbox, and each sees only their own. */
@Resolver(() => NotificationPageGql)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => NotificationPageGql, { complexity: pagedComplexity, description: 'Your notifications in this workspace, newest first' })
  @RequirePermissions()
  notifications(@Args() args: InboxArgs, @CurrentAccess() access: WorkspaceAccess, @CurrentUser() user: SessionUser): Promise<NotificationPageGql> {
    return this.notificationsService.inbox(access.workspaceId, user.id, { unreadOnly: args.unreadOnly, page: args.page, pageSize: args.pageSize });
  }

  @Query(() => Int)
  @RequirePermissions()
  unreadNotificationCount(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess, @CurrentUser() user: SessionUser): Promise<number> {
    return this.notificationsService.unreadCount(access.workspaceId, user.id);
  }

  @Mutation(() => Int, { description: 'Returns how many were unread' })
  @RequirePermissions()
  markNotificationsRead(@Args() args: MarkReadArgs, @CurrentAccess() access: WorkspaceAccess, @CurrentUser() user: SessionUser): Promise<number> {
    return this.notificationsService.markRead(access.workspaceId, user.id, args.ids);
  }

  @Mutation(() => Int, { description: 'Returns how many were unread' })
  @RequirePermissions()
  markAllNotificationsRead(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess, @CurrentUser() user: SessionUser): Promise<number> {
    return this.notificationsService.markAllRead(access.workspaceId, user.id);
  }
}
