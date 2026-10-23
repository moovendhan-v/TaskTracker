import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseHealthIndicator } from '../../../core/database/database-health.indicator.js';
import { Public } from '../../../core/http/decorators/public.decorator.js';

/**
 * Liveness probe for Docker and load balancers, which can only make plain GET
 * requests. It is the one HTTP route outside GraphQL and Better Auth.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseHealthIndicator) {}

  // Public: health checks run without a session. Returns no data.
  @Public()
  @SkipThrottle()
  @Get()
  async check(): Promise<{ status: 'ok' | 'degraded' }> {
    return { status: (await this.database.isUp()) ? 'ok' : 'degraded' };
  }
}
