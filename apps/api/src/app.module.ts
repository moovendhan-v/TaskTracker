import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { AccessModule } from './core/access/access.module.js';
import { DataScopeInterceptor } from './core/access/data-scope.interceptor.js';
import { AuditModule } from './core/audit/audit.module.js';
import { AuthModule } from './core/auth/auth.module.js';
import { CacheModule } from './core/cache/cache.module.js';
import { CryptoModule } from './core/crypto/crypto.module.js';
import { QueryModule } from './core/query/query.module.js';
import { SessionGuard } from './core/auth/session.guard.js';
import { DatabaseModule } from './core/database/database.module.js';
import { EventsModule } from './core/events/events.module.js';
import { RealtimeModule } from './core/realtime/realtime.module.js';
import { GraphqlApiModule } from './core/graphql/graphql-api.module.js';
import { TimeModule } from './core/time/time.module.js';
import { AllExceptionsFilter } from './core/http/filters/all-exceptions.filter.js';
import { UserThrottlerGuard } from './core/http/guards/user-throttler.guard.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuditLogModule } from './modules/audit-log/audit-log.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { AutomationsModule } from './modules/automations/automations.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HrModule } from './modules/hr/hr.module.js';
import { ListsModule } from './modules/lists/lists.module.js';
import { TypeOrmMembershipReader } from './modules/members/infrastructure/typeorm-membership.reader.js';
import { MembersModule } from './modules/members/members.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { RealtimeFeatureModule } from './modules/realtime/realtime.module.js';
import { ResourcesModule } from './modules/resources/resources.module.js';
import { FormsModule } from './modules/forms/forms.module.js';
import { PreferencesModule } from './modules/preferences/preferences.module.js';
import { StatusesModule } from './modules/statuses/statuses.module.js';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SpacesModule } from './modules/spaces/spaces.module.js';
import { SprintsModule } from './modules/sprints/sprints.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

/** Composition root: the only place that wires core ports to feature adapters. */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    TimeModule,
    EventsModule,
    RealtimeModule,
    CacheModule,
    CryptoModule,
    QueryModule,
    GraphqlApiModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    AuditModule,
    AccessModule.forRoot({ imports: [MembersModule], membershipReader: TypeOrmMembershipReader }),
    HealthModule,
    UsersModule,
    WorkspacesModule,
    MembersModule,
    RolesModule,
    SpacesModule,
    ListsModule,
    TasksModule,
    CommentsModule,
    SprintsModule,
    DocumentsModule,
    TemplatesModule,
    AutomationsModule,
    IntegrationsModule,
    HrModule,
    AuditLogModule,
    AdminModule,
    NotificationsModule,
    RealtimeFeatureModule,
    ResourcesModule,
    FormsModule,
    PreferencesModule,
    StatusesModule,
    CustomFieldsModule,
    TimeTrackingModule,
    AnalyticsModule,
  ],
  providers: [
    // Order matters: the session guard sets req.user, which the throttler uses as its key.
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    // Runs after the guards: opens each operation's transaction with its row-level security scope.
    { provide: APP_INTERCEPTOR, useClass: DataScopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
