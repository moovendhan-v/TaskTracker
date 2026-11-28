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
  /**
   * Atomically sets aside `tokens` of the person's budget for one request, only while they are under
   * `budget`; false when they are already at it. Concurrent requests can't all slip past the check.
   */
  abstract reserve(workspaceId: string, userId: string, day: string, tokens: number, budget: number): Promise<boolean>;
  /** Corrects a reservation to what was really used (negative to give some back). Returns the day's total. */
  abstract settle(workspaceId: string, userId: string, day: string, delta: number): Promise<number>;
}
