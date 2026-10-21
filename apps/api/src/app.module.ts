import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { AccessModule } from './core/access/access.module.js';
import { AuditModule } from './core/audit/audit.module.js';
import { AuthModule } from './core/auth/auth.module.js';
import { SessionGuard } from './core/auth/session.guard.js';
import { DatabaseModule } from './core/database/database.module.js';
import { AllExceptionsFilter } from './core/http/filters/all-exceptions.filter.js';
import { UserThrottlerGuard } from './core/http/guards/user-throttler.guard.js';
import { HealthModule } from './modules/health/health.module.js';
import { ListsModule } from './modules/lists/lists.module.js';
import { TypeOrmMembershipReader } from './modules/members/infrastructure/typeorm-membership.reader.js';
import { MembersModule } from './modules/members/members.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SpacesModule } from './modules/spaces/spaces.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

/** Composition root: the only place that wires core ports to feature adapters. */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
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
  ],
  providers: [
    // Order matters: the session guard sets req.user, which the throttler uses as its key.
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
