import { type ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

const NO_HEADERS_RESPONSE = { header: () => undefined, setHeader: () => undefined };

/** Rate limits GraphQL operations by user id when signed in, otherwise by client IP. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  // The return type is fixed by ThrottlerGuard's signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected override getRequestResponse(context: ExecutionContext): { req: Record<string, any>; res: Record<string, any> } {
    if (context.getType<GqlContextType>() === 'graphql') {
      const { req, res } = GqlExecutionContext.create(context).getContext<{ req: AuthenticatedRequest; res?: Response }>();
      // Subscriptions run over a WebSocket with no HTTP response to put rate-limit headers on, but starting
      // one still counts toward the caller's limit.
      return { req, res: res ?? NO_HEADERS_RESPONSE };
    }
    return super.getRequestResponse(context);
  }

  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    const req = request as unknown as AuthenticatedRequest;
    return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip ?? 'unknown'}`;
  }
}
