import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

/** Rate limits by user id when signed in, otherwise by client IP. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    const req = request as unknown as AuthenticatedRequest;
    return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip ?? 'unknown'}`;
  }
}
