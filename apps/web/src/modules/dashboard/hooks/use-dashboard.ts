import { useQuery } from '@tanstack/react-query';
import type { DashboardRequest } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { dashboardApi } from '../api/dashboard.api';

export function useDashboard(workspaceId: string, input: DashboardRequest) {
  return useQuery({
    queryKey: queryKeys.dashboard(workspaceId, input),
    queryFn: () => dashboardApi.get(workspaceId, input),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}
