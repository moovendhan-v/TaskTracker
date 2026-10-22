import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { AuthService } from './auth.service.js';
import { ConsoleMailer } from './mailer/console.mailer.js';
import { Mailer } from './mailer/mailer.port.js';
import { SmtpMailer } from './mailer/smtp.mailer.js';
import { SessionGuard } from './session.guard.js';

@Global()
@Module({
  providers: [
    AuthService,
    SessionGuard,
    {
      provide: Mailer,
      inject: [ENV],
      // The env schema requires SMTP settings in production, so the console mailer only runs in development and tests.
      useFactory: (env: Env): Mailer =>
        env.SMTP_URL && env.MAIL_FROM ? new SmtpMailer(env.SMTP_URL, env.MAIL_FROM) : new ConsoleMailer(env.NODE_ENV === 'development'),
    },
  ],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
