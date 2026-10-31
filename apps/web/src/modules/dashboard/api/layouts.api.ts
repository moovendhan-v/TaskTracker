import type { LayoutItem, LayoutPage } from '@taskflow/shared-types';
import { MyLayoutDocument, ResetLayoutDocument, SaveLayoutDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const layoutsApi = {
  get: async (workspaceId: string, pageKey: LayoutPage) => (await graphql(MyLayoutDocument, { workspaceId, pageKey })).myLayout,
  save: async (workspaceId: string, pageKey: LayoutPage, baseVersion: number | null, items: LayoutItem[]) =>
    (await graphql(SaveLayoutDocument, { workspaceId, input: { pageKey, baseVersion, items: items.map(({ id, type, x, y, w, h }) => ({ id, type, x, y, w, h })) } })).saveLayout,
  reset: async (workspaceId: string, pageKey: LayoutPage) => (await graphql(ResetLayoutDocument, { workspaceId, pageKey })).resetLayout,
};
