import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { loadAiProviders, type AiProviderConfig } from './ai-providers.config.js';
import { FakeModel } from './fake.model.js';
import type { LanguageModel } from './language-model.port.js';
import { OpenAiCompatibleModel } from './openai-compatible.model.js';

/** What clients may know about a configured provider: never its URL or key. */
export interface AiProviderSummary {
  id: string;
  label: string;
  models: string[];
}

/**
 * The configured AI providers, and the one place that turns a provider id into a model
 * adapter (open/closed: a new kind of provider is a new adapter class and one case here).
 */
@Injectable()
export class AiModelRegistry {
  private readonly providers: AiProviderConfig[];
  private readonly adapters = new Map<string, LanguageModel>();

  constructor(@Inject(ENV) env: Env) {
    this.providers = loadAiProviders(process.env, env.NODE_ENV);
    for (const provider of this.providers) {
      this.adapters.set(provider.id, provider.kind === 'fake' ? new FakeModel() : new OpenAiCompatibleModel({ baseUrl: provider.baseUrl, apiKey: provider.apiKey, timeoutMs: env.AI_TIMEOUT_SECONDS * 1000 }));
    }
  }

  get configured(): boolean {
    return this.providers.length > 0;
  }

  list(): AiProviderSummary[] {
    return this.providers.map((provider) => ({ id: provider.id, label: provider.label, models: [...provider.models] }));
  }

  /** The default choice: the first provider's first model. */
  defaultChoice(): { providerId: string; model: string } | null {
    const first = this.providers[0];
    return first ? { providerId: first.id, model: first.models[0]! } : null;
  }

  /** Whether this provider and model are configured (a saved choice may outlive the config). */
  isAllowed(providerId: string, model: string): boolean {
    return this.providers.some((provider) => provider.id === providerId && provider.models.includes(model));
  }

  modelFor(providerId: string): LanguageModel | null {
    return this.adapters.get(providerId) ?? null;
  }
}
