import { Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { AccessService } from '../../../core/access/access.service.js';
import { AuthService } from '../../../core/auth/auth.service.js';
import { EventStream } from '../../../core/realtime/event-stream.js';
import type { RealtimeEvent } from '../../../core/realtime/realtime-event.js';
import { Clock } from '../../../core/time/clock.port.js';
import type { SessionUser } from '../../../core/http/types/authenticated-request.js';

/** How long a subscription trusts its last session and membership check. */
export const RECHECK_INTERVAL_MS = 30_000;

/**
 * A workspace's live events for one subscriber. Events for other workspaces and
 * other people's notifications never reach it. The session and membership are
 * re-checked at least every 30 seconds: once either is gone (signed out,
 * suspended, removed from the workspace) the stream ends.
 */
@Injectable()
export class WorkspaceEventsService {
  constructor(
    private readonly stream: EventStream,
    private readonly authService: AuthService,
    private readonly accessService: AccessService,
    private readonly clock: Clock,
  ) {}

  subscribe(user: SessionUser, headers: IncomingHttpHeaders, workspaceId: string): AsyncIterableIterator<RealtimeEvent> {
    const source = this.stream.subscribe(
      (event) => event.workspaceId === workspaceId && (event.recipientId === null || event.recipientId === user.id),
    );
    let checkedAt = this.clock.now().getTime();
    const stillAllowed = async (): Promise<boolean> => {
      const current = await this.authService.getSessionUser(headers).catch(() => null);
      if (!current || current.id !== user.id) return false;
      return (await this.accessService.resolve(current, workspaceId)) !== null;
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: async () => {
        const result = await source.next();
        if (result.done) return result;
        const now = this.clock.now().getTime();
        if (now - checkedAt >= RECHECK_INTERVAL_MS) {
          if (!(await stillAllowed())) {
            await source.return?.();
            return { value: undefined, done: true };
          }
          checkedAt = now;
        }
        return result;
      },
      return: () => source.return?.() ?? Promise.resolve({ value: undefined, done: true }),
      throw: (error?: unknown) => source.throw?.(error) ?? Promise.reject(error),
    };
  }
}
