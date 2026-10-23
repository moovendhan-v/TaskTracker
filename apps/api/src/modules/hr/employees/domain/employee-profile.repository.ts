import type { DirectoryEntry, EmployeeProfile, ProfileFields } from './employee-profile.js';

export abstract class EmployeeProfileRepository {
  /** Every current member, ordered by name, capped at `limit`. */
  abstract directory(workspaceId: string, limit: number): Promise<DirectoryEntry[]>;
  abstract findEntry(workspaceId: string, userId: string): Promise<DirectoryEntry | null>;
  abstract findProfile(workspaceId: string, userId: string): Promise<EmployeeProfile | null>;
  /** Chain of managers above a person: [manager, manager's manager, …]. */
  abstract managerChain(workspaceId: string, userId: string): Promise<string[]>;
  abstract upsert(workspaceId: string, userId: string, fields: ProfileFields): Promise<void>;
}
