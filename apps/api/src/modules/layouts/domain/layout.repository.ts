import type { DashboardLayout, LayoutItem, LayoutPage, LayoutVersion, WorkspaceLayout } from '@taskflow/shared-types';

export interface LayoutKey {
  workspaceId: string;
  userId: string;
  pageKey: LayoutPage;
}

/** Stores one layout per user, workspace and page. */
export abstract class LayoutRepository {
  abstract find(key: LayoutKey): Promise<DashboardLayout | null>;
  /**
   * Writes the layout only if the stored version is still `baseVersion`
   * (`null`: nothing stored yet). Returns null when someone saved in between.
   */
  abstract saveIfVersion(key: LayoutKey, baseVersion: number | null, items: LayoutItem[]): Promise<DashboardLayout | null>;
  abstract remove(key: LayoutKey): Promise<void>;

  /** Keeps a copy of a save, and only the newest `keep` copies of that page. */
  abstract addVersion(key: LayoutKey, version: number, items: LayoutItem[], keep: number): Promise<void>;
  abstract listVersions(key: LayoutKey, limit: number): Promise<LayoutVersion[]>;

  abstract findDefault(workspaceId: string, pageKey: LayoutPage): Promise<WorkspaceLayout | null>;
  abstract saveDefault(workspaceId: string, pageKey: LayoutPage, items: LayoutItem[], userId: string): Promise<WorkspaceLayout>;
  /** False when the page has no workspace default to lock. */
  abstract setDefaultLocked(workspaceId: string, pageKey: LayoutPage, locked: boolean): Promise<boolean>;
  abstract removeDefault(workspaceId: string, pageKey: LayoutPage): Promise<boolean>;
}
