import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../../core/http/decorators/public.decorator.js';
import { CallsService } from '../../application/calls.service.js';

/**
 * LiveKit's webhooks for calls (D2). The body arrives raw (bootstrap/webhook-routes.bootstrap.ts)
 * because the signature covers its exact bytes.
 */
@Controller('integrations/livekit/webhook')
export class LivekitWebhookController {
  constructor(private readonly calls: CallsService) {}

  // Public: LiveKit calls this without a session. Every delivery must carry a JWT signed with
  // the LiveKit API secret over the body's SHA-256, or it is refused.
  @Public()
  // One media server sends every event, so allow more than the default per address.
  @Throttle({ default: { limit: 1200, ttl: 60_000 } })
  @Post()
  @HttpCode(200)
  async receive(@Headers('authorization') authorization: string | undefined, @Req() request: Request): Promise<{ result: string }> {
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    const result = await this.calls.webhook(rawBody, authorization);
    if (result === 'invalid') throw new UnauthorizedException('Invalid signature');
    return { result };
  }
}
