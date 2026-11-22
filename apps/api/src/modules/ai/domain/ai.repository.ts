export interface AiSettings {
  workspaceId: string;
  enabled: boolean;
  providerId: string | null;
  model: string | null;
}

export abstract class AiRepository {
  abstract getSettings(workspaceId: string): Promise<AiSettings | null>;
  abstract saveSettings(settings: AiSettings, updatedById: string): Promise<void>;
  /** Tokens this person used in this workspace on this day (YYYY-MM-DD, UTC). */
  abstract tokensUsed(workspaceId: string, userId: string, day: string): Promise<number>;
  abstract addUsage(workspaceId: string, userId: string, day: string, tokens: number): Promise<number>;
}
