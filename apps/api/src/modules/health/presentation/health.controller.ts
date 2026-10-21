import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseHealthIndicator } from '../../../core/database/database-health.indicator.js';
import { Public } from '../../../core/http/decorators/public.decorator.js';
import { HealthResponseDto } from './dto/health.response.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseHealthIndicator) {}

  // Public: container and load balancer health checks run without a session. Returns no data.
  @Public()
  @SkipThrottle()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  async check(): Promise<HealthResponseDto> {
    return { status: (await this.database.isUp()) ? 'ok' : 'degraded' };
  }
}
