import { Module } from '@nestjs/common';
import { WorkspaceEventsService } from './application/workspace-events.service.js';
import { WorkspaceEventsResolver } from './presentation/graphql/workspace-events.resolver.js';

@Module({ providers: [WorkspaceEventsService, WorkspaceEventsResolver] })
export class RealtimeFeatureModule {}
