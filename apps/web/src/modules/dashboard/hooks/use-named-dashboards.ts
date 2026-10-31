import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardVisibility, LayoutItem, NamedDashboardResponse } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { dashboardsApi } from '../api/layouts.api';

/** Your dashboards and the ones shared with the workspace. */
export function useNamedDashboards(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.dashboards(workspaceId), queryFn: () => dashboardsApi.list(workspaceId), staleTime: 60_000 });
}

export function useNamedDashboardMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({
      mutationFn: (input: { name: string; visibility: DashboardVisibility; items?: LayoutItem[] }) => dashboardsApi.create(workspaceId, input),
      // Into the list straight away, so switching to the new tab doesn't briefly find nothing.
      onSuccess: (created) => {
        queryClient.setQueryData<NamedDashboardResponse[]>(queryKeys.dashboards(workspaceId), (list = []) => [...list.filter((item) => item.id !== created.id), created]);
        refresh();
      },
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string; name?: string; visibility?: DashboardVisibility }) => dashboardsApi.update(workspaceId, id, input),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({ mutationFn: (id: string) => dashboardsApi.remove(workspaceId, id), onSuccess: refresh, onError }),
  };
}
