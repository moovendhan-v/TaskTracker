import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import type { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator.js';

class HealthDto {
  @ApiProperty({ enum: ['ok', 'degraded'] }) status: 'ok' | 'degraded';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Public: container and load balancer health checks run without a session. Returns no data.
  @Public()
  @SkipThrottle()
  @Get()
  @ApiOkResponse({ type: HealthDto })
  async check(): Promise<HealthDto> {
    const ok = await this.dataSource.query('SELECT 1').then(
      () => true,
      () => false,
    );
    return { status: ok ? 'ok' : 'degraded' };
  }
}
