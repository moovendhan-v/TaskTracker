import { cleanLayoutItem, DASHBOARD_PERIODS, type BlockConfig, type DashboardPeriod, type DashboardVisibility, type LayoutItem, type LayoutPage, type NamedDashboardResponse } from '@taskflow/shared-types';
import {
  CreateDashboardDocument,
  DashboardsDocument,
  DeleteDashboardDocument,
  MyLayoutDocument,
  ResetLayoutDocument,
  SaveDashboardLayoutDocument,
  SaveLayoutDocument,
  UpdateDashboardDocument,
  MyLayoutVersionsDocument,
  WorkspaceLayoutDocument,
  SetWorkspaceLayoutDocument,
  SetWorkspaceLayoutLockedDocument,
  ClearWorkspaceLayoutDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Items as the API takes them: stored fields only, no empty settings. */
const toInput = (item: LayoutItem) => cleanLayoutItem(item);

/** Items as the API returns them (unset settings come back as null). */
export function fromApiItems(items: readonly ApiItem[]): LayoutItem[] {
  return items.map((item) => cleanLayoutItem({ ...item, config: item.config ? ({ ...item.config } as BlockConfig) : null }));
}

type ApiItem = Omit<LayoutItem, 'config'> & { config?: Record<string, unknown> | null };

function withItems<T extends { items: readonly ApiItem[] }>(layout: T | null | undefined): (Omit<T, 'items'> & { items: LayoutItem[] }) | null {
  return layout ? { ...layout, items: fromApiItems(layout.items) } : null;
}

export const layoutsApi = {
  get: async (workspaceId: string, pageKey: LayoutPage) => withItems((await graphql(MyLayoutDocument, { workspaceId, pageKey })).myLayout),
  save: async (workspaceId: string, pageKey: LayoutPage, baseVersion: number | null, items: LayoutItem[]) =>
    withItems((await graphql(SaveLayoutDocument, { workspaceId, input: { pageKey, baseVersion, items: items.map(toInput) } })).saveLayout)!,
  reset: async (workspaceId: string, pageKey: LayoutPage) => (await graphql(ResetLayoutDocument, { workspaceId, pageKey })).resetLayout,
  versions: async (workspaceId: string, pageKey: LayoutPage) =>
    (await graphql(MyLayoutVersionsDocument, { workspaceId, pageKey })).myLayoutVersions.map((version) => ({ ...version, items: fromApiItems(version.items) })),
  workspaceDefault: async (workspaceId: string, pageKey: LayoutPage) => withItems((await graphql(WorkspaceLayoutDocument, { workspaceId, pageKey })).workspaceLayout),
  setWorkspaceDefault: async (workspaceId: string, pageKey: LayoutPage, items: LayoutItem[]) =>
    (await graphql(SetWorkspaceLayoutDocument, { workspaceId, input: { pageKey, items: items.map(toInput) } })).setWorkspaceLayout,
  setWorkspaceDefaultLocked: async (workspaceId: string, pageKey: LayoutPage, locked: boolean) =>
    (await graphql(SetWorkspaceLayoutLockedDocument, { workspaceId, pageKey, locked })).setWorkspaceLayoutLocked,
  clearWorkspaceDefault: async (workspaceId: string, pageKey: LayoutPage) => (await graphql(ClearWorkspaceLayoutDocument, { workspaceId, pageKey })).clearWorkspaceLayout,
};

const itemsOnly = (items: readonly LayoutItem[]) => items.map(toInput);
const asDashboard = (fields: { visibility: string; period?: string | null; items: readonly ApiItem[] } & Omit<NamedDashboardResponse, 'visibility' | 'period' | 'items'>): NamedDashboardResponse => ({
  ...fields,
  visibility: fields.visibility as DashboardVisibility,
  // Only ranges this app knows; anything else falls back to the page's own.
  period: (DASHBOARD_PERIODS as readonly string[]).includes(fields.period ?? '') ? (fields.period as DashboardPeriod) : null,
  items: fromApiItems(fields.items),
});

/** Named Home dashboards (tabs): yours plus the ones shared with the workspace. */
export const dashboardsApi = {
  list: async (workspaceId: string) => (await graphql(DashboardsDocument, { workspaceId })).dashboards.map(asDashboard),
  create: async (workspaceId: string, input: { name: string; visibility: DashboardVisibility; items?: LayoutItem[] }) =>
    asDashboard((await graphql(CreateDashboardDocument, { workspaceId, input: { ...input, items: input.items ? itemsOnly(input.items) : null } })).createDashboard),
  update: async (workspaceId: string, dashboardId: string, input: { name?: string; visibility?: DashboardVisibility; period?: DashboardPeriod }) =>
    asDashboard((await graphql(UpdateDashboardDocument, { workspaceId, dashboardId, input })).updateDashboard),
  saveLayout: async (workspaceId: string, dashboardId: string, baseVersion: number, items: LayoutItem[]) =>
    asDashboard((await graphql(SaveDashboardLayoutDocument, { workspaceId, dashboardId, input: { baseVersion, items: itemsOnly(items) } })).saveDashboardLayout),
  remove: async (workspaceId: string, dashboardId: string) => (await graphql(DeleteDashboardDocument, { workspaceId, dashboardId })).deleteDashboard,
};
