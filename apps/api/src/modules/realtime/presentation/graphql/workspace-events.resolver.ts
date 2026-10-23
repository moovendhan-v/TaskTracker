import { Resolver, Subscription } from '@nestjs/graphql';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentRequest } from '../../../../core/http/decorators/current-request.decorator.js';
import type { AuthenticatedRequest } from '../../../../core/http/types/authenticated-request.js';
import type { RealtimeEvent } from '../../../../core/realtime/realtime-event.js';
import { WorkspaceEventsService } from '../../application/workspace-events.service.js';
import { WorkspaceEventGql } from './workspace-event.types.js';

@Resolver(() => WorkspaceEventGql)
export class WorkspaceEventsResolver {
  constructor(private readonly eventsService: WorkspaceEventsService) {}

  /** Over WebSocket (graphql-ws) at /api/graphql. Members only; the guard runs when the subscription starts. */
  @Subscription(() => WorkspaceEventGql, {
    description: 'Live changes in a workspace, including your own new notifications',
    resolve: (event: RealtimeEvent): WorkspaceEventGql => ({
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
    }),
  })
  @RequirePermissions()
  workspaceEvents(@WorkspaceIdArg() workspaceId: string, @CurrentRequest() request: AuthenticatedRequest): AsyncIterableIterator<RealtimeEvent> {
    return this.eventsService.subscribe(request.user, request.headers, workspaceId);
  }
}
