import type { DashboardRequest } from '@taskflow/shared-types';
import { DashboardDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const dashboardApi = {
  get: async (workspaceId: string, input: DashboardRequest) => (await graphql(DashboardDocument, { workspaceId, input })).dashboard,
};
