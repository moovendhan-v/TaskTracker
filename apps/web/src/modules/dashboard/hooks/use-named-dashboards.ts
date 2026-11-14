import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardPeriod, DashboardVisibility, LayoutItem, NamedDashboardResponse } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { dashboardsApi } from '../api/layouts.api';

/** Your dashboards, and the ones shared with the workspace or a team you're in: Home's, or one project's. */
export function useNamedDashboards(workspaceId: string, spaceId: string | null = null) {
  return useQuery({ queryKey: [...queryKeys.dashboards(workspaceId), spaceId ?? 'home'], queryFn: () => dashboardsApi.list(workspaceId, spaceId), staleTime: 60_000 });
}

/** Teams (departments you're in or lead) you can share a dashboard with. */
export function useDashboardTeams(workspaceId: string, enabled = true) {
  return useQuery({ queryKey: [...queryKeys.dashboards(workspaceId), 'teams'], queryFn: () => dashboardsApi.teams(workspaceId), staleTime: 5 * 60_000, enabled });
}

export function useNamedDashboardMutations(workspaceId: string, spaceId: string | null = null) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({
      mutationFn: (input: { name: string; visibility: DashboardVisibility; items?: LayoutItem[] }) => dashboardsApi.create(workspaceId, { ...input, spaceId }),
      // Into the list straight away, so switching to the new tab doesn't briefly find nothing.
      onSuccess: (created) => {
        queryClient.setQueryData<NamedDashboardResponse[]>([...queryKeys.dashboards(workspaceId), spaceId ?? 'home'], (list = []) => [...list.filter((item) => item.id !== created.id), created]);
        refresh();
      },
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string; name?: string; visibility?: DashboardVisibility; departmentId?: string; period?: DashboardPeriod }) => dashboardsApi.update(workspaceId, id, input),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({ mutationFn: (id: string) => dashboardsApi.remove(workspaceId, id), onSuccess: refresh, onError }),
  };
}
