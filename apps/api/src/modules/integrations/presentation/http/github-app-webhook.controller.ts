import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../../core/http/decorators/public.decorator.js';
import { GithubAppWebhookService } from '../../application/github-app-webhook.service.js';

export const GITHUB_APP_WEBHOOK_ROUTE = 'integrations/github/app-webhook';

/** The GitHub App's webhook. The body arrives raw (bootstrap/webhook-routes.bootstrap.ts): the signature covers its exact bytes. */
@Controller(GITHUB_APP_WEBHOOK_ROUTE)
export class GithubAppWebhookController {
  constructor(private readonly webhooks: GithubAppWebhookService) {}

  // Public: GitHub calls this without a session. Every delivery must carry an HMAC-SHA256
  // signature made with GITHUB_APP_WEBHOOK_SECRET, or it is refused (and with no secret
  // configured, everything is).
  @Public()
  // GitHub sends from shared addresses, so allow more than the default per IP.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post()
  @HttpCode(202)
  async receive(
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: Request,
  ): Promise<{ result: string }> {
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    const result = await this.webhooks.receive({ event, deliveryId, signature, rawBody });
    if (result === 'invalid') throw new UnauthorizedException('Invalid signature');
    return { result };
  }
}
