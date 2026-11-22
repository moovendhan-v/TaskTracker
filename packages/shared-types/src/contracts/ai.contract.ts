/** E5 AI: a provider the server has configured. Its URL and key never leave the server. */
export interface AiProviderOption {
  id: string;
  label: string;
  models: string[];
}

export interface AiSettingsResponse {
  /** The server has at least one provider configured. */
  available: boolean;
  /** This workspace turned AI on. */
  enabled: boolean;
  providerId: string | null;
  model: string | null;
  providers: AiProviderOption[];
  /** The signed-in person's budget and use today in this workspace (tokens). */
  dailyTokens: number;
  usedToday: number;
}

export interface UpdateAiSettingsRequest {
  enabled: boolean;
  providerId?: string | null;
  model?: string | null;
}

export type AiSummaryTarget = 'task' | 'document' | 'chat';

export interface AiSummaryResponse {
  /** Plain text written by a model: show it as text, never as HTML. */
  text: string;
  providerLabel: string;
  model: string;
  tokens: number;
  usedToday: number;
  dailyTokens: number;
}

export const AI_LIMITS = {
  /** The most source text sent for one summary (characters); older content is dropped first. */
  sourceChars: 24_000,
  /** Answer budget; generous because thinking models spend part of it before answering. */
  outputTokens: 1_500,
  /** Chat messages read for a channel summary. */
  chatMessages: 100,
} as const;
