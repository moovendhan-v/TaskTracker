import { deleteUpload } from '../../../core/storage/upload-checks.js';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { type ChatRetentionDays, type ChatRetentionResponse } from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { FileStorage } from '../../../core/storage/file-storage.port.js';
import { Clock } from '../../../core/time/clock.port.js';
import { ChatRetentionRepository } from '../domain/chat-retention.repository.js';

/** Bounds on one sweep, so a big backlog drains over several ticks instead of one long transaction. */
const WORKSPACES_PER_TICK = 200;
const THREADS_PER_WORKSPACE = 500;
const DAY_MS = 86_400_000;

/**
 * Chat retention (D1): how long a workspace keeps chat, and the sweep that
 * removes threads whose last message is older than that. A whole thread goes at
 * once (root, replies, reactions, files), never half a conversation. Only people
 * who manage the workspace change the setting, and every change is audited.
 */
@Injectable()
export class ChatRetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ChatRetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly retention: ChatRetentionRepository,
    private readonly transactional: TransactionalManager,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async get(workspaceId: string): Promise<ChatRetentionResponse> {
    return { id: workspaceId, workspaceId, days: await this.retention.getDays(workspaceId) };
  }

  @Audited('chat.retention.update', { targetType: 'workspace', metadata: (result: ChatRetentionResponse) => ({ days: result.days }) })
  async set(_actor: Actor, workspaceId: string, days: ChatRetentionDays | null): Promise<ChatRetentionResponse> {
    await this.retention.setDays(workspaceId, days);
    return this.get(workspaceId);
  }

  onApplicationBootstrap(): void {
    if (this.env.CHAT_RETENTION_SWEEP_SECONDS === 0) return;
    this.timer = setInterval(() => void this.sweep(), this.env.CHAT_RETENTION_SWEEP_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One pass over every workspace with a retention setting. Never throws; failures are logged per workspace. */
  async sweep(): Promise<number> {
    if (this.sweeping) return 0;
    this.sweeping = true;
    let removed = 0;
    try {
      const now = this.clock.now().getTime();
      const workspaces = await this.transactional.runInScope({ kind: 'platform' }, () => this.retention.workspacesWithRetention(WORKSPACES_PER_TICK));
      for (const { workspaceId, days } of workspaces) {
        try {
          const before = new Date(now - days * DAY_MS);
          const keys = await this.transactional.runInScope({ kind: 'platform' }, async () => {
            const threads = await this.retention.expiredThreads(workspaceId, before, THREADS_PER_WORKSPACE);
            removed += await this.retention.deleteThreads(workspaceId, threads.map((thread) => thread.rootId));
            return threads.flatMap((thread) => thread.storageKeys);
          });
          // The files go after the rows have committed; a file left behind has no row and no link.
          for (const key of keys) await deleteUpload(this.storage, key);
        } catch (error) {
          this.logger.error('Chat retention sweep failed for a workspace', error instanceof Error ? error.stack : undefined);
        }
      }
    } catch (error) {
      this.logger.error('Chat retention sweep failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.sweeping = false;
    }
    if (removed) this.logger.log(`Chat retention removed ${removed} thread(s)`);
    return removed;
  }
}
