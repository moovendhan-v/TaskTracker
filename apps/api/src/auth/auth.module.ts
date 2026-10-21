import { Global, Module } from '@nestjs/common';
import { pgPoolProvider } from '../database/pg-pool.provider.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';

@Global()
@Module({
  providers: [pgPoolProvider, AuthService, SessionGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
