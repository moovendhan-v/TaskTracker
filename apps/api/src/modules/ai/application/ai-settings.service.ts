import { Inject, Injectable } from '@nestjs/common';
import type { AiSettingsResponse, UpdateAiSettingsRequest } from '@taskflow/shared-types';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { AiModelRegistry } from '../../../core/ai/ai-model.registry.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../core/time/clock.port.js';
import { AiRepository, type AiSettings } from '../domain/ai.repository.js';

/** A workspace's AI switch and its pick among the providers the server has configured. */
@Injectable()
export class AiSettingsService {
  constructor(
    private readonly ai: AiRepository,
    private readonly registry: AiModelRegistry,
    private readonly auditLogger: AuditLogger,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async get(access: WorkspaceAccess, actor: Actor): Promise<AiSettingsResponse> {
    const settings = await this.effective(access.workspaceId);
    return {
      available: this.registry.configured,
      enabled: settings.enabled,
      providerId: settings.providerId,
      model: settings.model,
      providers: this.registry.list(),
      dailyTokens: this.env.AI_DAILY_TOKENS_PER_USER,
      usedToday: await this.ai.tokensUsed(access.workspaceId, actor.userId, this.today()),
    };
  }

  /** Needs workspace.manage (checked by the resolver). Only configured providers and models can be picked; audited. */
  async update(actor: Actor, access: WorkspaceAccess, request: UpdateAiSettingsRequest): Promise<AiSettingsResponse> {
    const before = await this.effective(access.workspaceId);
    const fallback = this.registry.defaultChoice();
    const providerId = request.providerId ?? before.providerId ?? fallback?.providerId ?? null;
    const model = request.model ?? (providerId === before.providerId ? before.model : null) ?? this.registry.list().find((provider) => provider.id === providerId)?.models[0] ?? null;
    if (request.enabled && !this.registry.configured) throw DomainError.invalid('No AI provider is set up on this server yet');
    if (providerId !== null && model !== null && !this.registry.isAllowed(providerId, model)) throw DomainError.invalid('Pick a provider and model from the list');
    const next: AiSettings = { workspaceId: access.workspaceId, enabled: request.enabled, providerId, model };
    await this.ai.saveSettings(next, actor.userId);
    await this.auditLogger.record(actor, {
      action: 'workspace.ai.update',
      targetType: 'workspace',
      targetId: access.workspaceId,
      workspaceId: access.workspaceId,
      metadata: { from: { enabled: before.enabled, providerId: before.providerId, model: before.model }, to: { enabled: next.enabled, providerId, model } },
    });
    return this.get(access, actor);
  }

  /** Saved settings, with a model the server no longer offers treated as unset. */
  async effective(workspaceId: string): Promise<AiSettings> {
    const saved = await this.ai.getSettings(workspaceId);
    if (!saved) return { workspaceId, enabled: false, providerId: null, model: null };
    if (saved.providerId && saved.model && !this.registry.isAllowed(saved.providerId, saved.model)) return { ...saved, providerId: null, model: null };
    return saved;
  }

  today(): string {
    return this.clock.now().toISOString().slice(0, 10);
  }
}
