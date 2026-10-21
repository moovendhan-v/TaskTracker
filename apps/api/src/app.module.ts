import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from './access/access.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SessionGuard } from './auth/session.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard.js';
import { AppConfigModule, ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { buildDataSourceOptions } from './database/data-source-options.js';
import { HealthModule } from './health/health.module.js';
import { ListsModule } from './lists/lists.module.js';
import { MembersModule } from './members/members.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SpacesModule } from './spaces/spaces.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { UsersModule } from './users/users.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => buildDataSourceOptions(env) }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    AuditModule,
    AccessModule,
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
