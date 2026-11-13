import type { DashboardPeriod, DashboardTeam, DashboardVisibility, LayoutItem, LayoutVersion } from '@taskflow/shared-types';

export interface DashboardRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  visibility: DashboardVisibility;
  items: LayoutItem[];
  version: number;
  period: DashboardPeriod | null;
  departmentId: string | null;
  departmentName: string | null;
  updatedAt: Date;
}

/** Named dashboards. Reads return what the caller may see (theirs + shared); writes touch only their own. */
export abstract class DashboardRepository {
  abstract listVisible(workspaceId: string, userId: string): Promise<DashboardRecord[]>;
  abstract findVisible(workspaceId: string, userId: string, id: string): Promise<DashboardRecord | null>;
  abstract countOwned(workspaceId: string, ownerId: string): Promise<number>;
  abstract create(record: Pick<DashboardRecord, 'workspaceId' | 'ownerId' | 'name' | 'visibility' | 'items'>): Promise<DashboardRecord>;
  abstract rename(workspaceId: string, ownerId: string, id: string, changes: { name?: string; visibility?: DashboardVisibility; departmentId?: string | null; period?: DashboardPeriod }): Promise<DashboardRecord | null>;
  /** Saves items only if the stored version is still `baseVersion`; null when it changed (or isn't theirs). */
  abstract saveItemsIfVersion(workspaceId: string, ownerId: string, id: string, baseVersion: number, items: LayoutItem[]): Promise<DashboardRecord | null>;
  abstract remove(workspaceId: string, ownerId: string, id: string): Promise<boolean>;
  /** Keeps a copy of a save, and only the newest `keep` copies of that dashboard. */
  abstract addVersion(workspaceId: string, dashboardId: string, version: number, items: LayoutItem[], keep: number): Promise<void>;
  abstract listVersions(workspaceId: string, dashboardId: string, limit: number): Promise<LayoutVersion[]>;
  /** Departments the user belongs to (HR profile) or heads: the teams they may share with. */
  abstract teamsOf(workspaceId: string, userId: string): Promise<DashboardTeam[]>;
}
