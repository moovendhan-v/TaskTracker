export abstract class PreferencesRepository {
  /** The stored JSON, or null for a user who never changed anything. */
  abstract find(userId: string): Promise<unknown>;
  abstract save(userId: string, data: object): Promise<void>;
}
