import type { DashboardLayout, LayoutItem, LayoutPage } from '@taskflow/shared-types';

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
}
