import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { AiRepository, type AiSettings } from '../domain/ai.repository.js';

@Injectable()
export class TypeOrmAiRepository extends AiRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async getSettings(workspaceId: string): Promise<AiSettings | null> {
    const [row] = (await this.transactional.manager.query(`SELECT enabled, provider_id, model FROM workspace_ai_setting WHERE workspace_id = $1`, [workspaceId])) as {
      enabled: boolean;
      provider_id: string | null;
      model: string | null;
    }[];
    return row ? { workspaceId, enabled: row.enabled, providerId: row.provider_id, model: row.model } : null;
  }

  async saveSettings(settings: AiSettings, updatedById: string): Promise<void> {
    await this.transactional.manager.query(
      `INSERT INTO workspace_ai_setting (workspace_id, enabled, provider_id, model, updated_by_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (workspace_id) DO UPDATE SET enabled = EXCLUDED.enabled, provider_id = EXCLUDED.provider_id, model = EXCLUDED.model, updated_by_id = EXCLUDED.updated_by_id, updated_at = now()`,
      [settings.workspaceId, settings.enabled, settings.providerId, settings.model, updatedById],
    );
  }

  async tokensUsed(workspaceId: string, userId: string, day: string): Promise<number> {
    const [row] = (await this.transactional.manager.query(`SELECT tokens FROM ai_usage WHERE workspace_id = $1 AND user_id = $2 AND day = $3::date`, [workspaceId, userId, day])) as { tokens: number }[];
    return row?.tokens ?? 0;
  }

  async reserve(workspaceId: string, userId: string, day: string, tokens: number, budget: number): Promise<boolean> {
    const rows = (await this.transactional.manager.query(
      `INSERT INTO ai_usage (workspace_id, user_id, day, requests, tokens) VALUES ($1, $2, $3::date, 1, $4)
       ON CONFLICT (workspace_id, user_id, day) DO UPDATE SET requests = ai_usage.requests + 1, tokens = LEAST(ai_usage.tokens + EXCLUDED.tokens, 2000000000)
       WHERE ai_usage.tokens < $5
       RETURNING tokens`,
      [workspaceId, userId, day, Math.max(0, Math.min(tokens, 1_000_000)), budget],
    )) as unknown[];
    return rows.length > 0;
  }

  async settle(workspaceId: string, userId: string, day: string, delta: number): Promise<number> {
    const [row] = (await this.transactional.manager.query(
      `UPDATE ai_usage SET tokens = GREATEST(0, LEAST(tokens + $4, 2000000000)) WHERE workspace_id = $1 AND user_id = $2 AND day = $3::date RETURNING tokens`,
      [workspaceId, userId, day, Math.round(delta)],
    )) as { tokens: number }[];
    return row?.tokens ?? 0;
  }

  async addUsage(workspaceId: string, userId: string, day: string, tokens: number): Promise<number> {
    const [row] = (await this.transactional.manager.query(
      `INSERT INTO ai_usage (workspace_id, user_id, day, requests, tokens) VALUES ($1, $2, $3::date, 1, $4)
       ON CONFLICT (workspace_id, user_id, day) DO UPDATE SET requests = ai_usage.requests + 1, tokens = LEAST(ai_usage.tokens + EXCLUDED.tokens, 2000000000)
       RETURNING tokens`,
      [workspaceId, userId, day, Math.max(0, Math.min(tokens, 1_000_000))],
    )) as { tokens: number }[];
    return row?.tokens ?? tokens;
  }
}
