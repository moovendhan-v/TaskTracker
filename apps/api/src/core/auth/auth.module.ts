import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { AuthService } from './auth.service.js';
import { ConsoleMailer } from './mailer/console.mailer.js';
import { Mailer } from './mailer/mailer.port.js';
import { SessionGuard } from './session.guard.js';

@Global()
@Module({
  providers: [
    AuthService,
    SessionGuard,
    { provide: Mailer, inject: [ENV], useFactory: (env: Env) => new ConsoleMailer(env.NODE_ENV === 'development') },
  ],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
