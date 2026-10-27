import { Controller, Headers, HttpCode, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../../core/http/decorators/public.decorator.js';
import { GITHUB_WEBHOOK_ROUTE } from '../../application/github.mapper.js';
import { GithubWebhookService } from '../../application/github-webhook.service.js';

/**
 * Receives GitHub webhook deliveries. The body arrives raw (see
 * bootstrap/webhook-routes.bootstrap.ts) because the signature covers its exact bytes.
 */
@Controller(GITHUB_WEBHOOK_ROUTE)
export class GithubWebhookController {
  constructor(private readonly webhooks: GithubWebhookService) {}

  // Public: GitHub calls this without a session. Every delivery must carry an
  // HMAC-SHA256 signature made with the connection's secret, or it is refused.
  @Public()
  // GitHub sends from shared addresses, so allow more than the default per IP.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post(':connectionId')
  @HttpCode(202)
  async receive(
    @Param('connectionId') connectionId: string,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: Request,
  ): Promise<{ result: string }> {
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    const result = await this.webhooks.receive({ connectionId, event, deliveryId, signature, rawBody });
    // One answer for an unknown connection and a bad signature, so ids can't be probed.
    if (result === 'invalid') throw new UnauthorizedException('Invalid signature');
    return { result };
  }
}
