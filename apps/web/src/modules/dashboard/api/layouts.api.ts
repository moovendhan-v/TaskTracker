import type { DashboardVisibility, LayoutItem, LayoutPage, NamedDashboardResponse } from '@taskflow/shared-types';
import {
  CreateDashboardDocument,
  DashboardsDocument,
  DeleteDashboardDocument,
  MyLayoutDocument,
  ResetLayoutDocument,
  SaveDashboardLayoutDocument,
  SaveLayoutDocument,
  UpdateDashboardDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const layoutsApi = {
  get: async (workspaceId: string, pageKey: LayoutPage) => (await graphql(MyLayoutDocument, { workspaceId, pageKey })).myLayout,
  save: async (workspaceId: string, pageKey: LayoutPage, baseVersion: number | null, items: LayoutItem[]) =>
    (await graphql(SaveLayoutDocument, { workspaceId, input: { pageKey, baseVersion, items: items.map(({ id, type, x, y, w, h }) => ({ id, type, x, y, w, h })) } })).saveLayout,
  reset: async (workspaceId: string, pageKey: LayoutPage) => (await graphql(ResetLayoutDocument, { workspaceId, pageKey })).resetLayout,
};

const itemsOnly = (items: readonly LayoutItem[]) => items.map(({ id, type, x, y, w, h }) => ({ id, type, x, y, w, h }));
const asDashboard = (fields: { visibility: string } & Omit<NamedDashboardResponse, 'visibility'>): NamedDashboardResponse => ({ ...fields, visibility: fields.visibility as DashboardVisibility });

/** Named Home dashboards (tabs): yours plus the ones shared with the workspace. */
export const dashboardsApi = {
  list: async (workspaceId: string) => (await graphql(DashboardsDocument, { workspaceId })).dashboards.map(asDashboard),
  create: async (workspaceId: string, input: { name: string; visibility: DashboardVisibility; items?: LayoutItem[] }) =>
    asDashboard((await graphql(CreateDashboardDocument, { workspaceId, input: { ...input, items: input.items ? itemsOnly(input.items) : null } })).createDashboard),
  update: async (workspaceId: string, dashboardId: string, input: { name?: string; visibility?: DashboardVisibility }) =>
    asDashboard((await graphql(UpdateDashboardDocument, { workspaceId, dashboardId, input })).updateDashboard),
  saveLayout: async (workspaceId: string, dashboardId: string, baseVersion: number, items: LayoutItem[]) =>
    asDashboard((await graphql(SaveDashboardLayoutDocument, { workspaceId, dashboardId, input: { baseVersion, items: itemsOnly(items) } })).saveDashboardLayout),
  remove: async (workspaceId: string, dashboardId: string) => (await graphql(DeleteDashboardDocument, { workspaceId, dashboardId })).deleteDashboard,
};
