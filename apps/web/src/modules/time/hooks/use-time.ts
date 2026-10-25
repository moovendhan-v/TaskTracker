import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LogTimeRequest, TimeEntryQuery, UpdateTimeEntryRequest } from '@taskflow/shared-types';
import { notify } from '@/components/kit/notify';
import { queryKeys } from '@/lib/query-keys';
import { usePermissions } from '@/modules/workspaces';
import { timeApi } from '../api/time.api';

export function useRunningTimer(workspaceId: string) {
  const { can } = usePermissions(workspaceId);
  return useQuery({ queryKey: queryKeys.runningTimer(workspaceId), queryFn: () => timeApi.running(workspaceId), enabled: can('time.log') });
}

export function useTimeEntries(workspaceId: string, query: TimeEntryQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.timeEntries(workspaceId, query),
    queryFn: () => timeApi.list(workspaceId, query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useTaskTime(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.taskTime(workspaceId, taskId), queryFn: () => timeApi.taskSummary(workspaceId, taskId) });
}

/** Every time change refreshes timesheets, reports, task totals and dashboards. */
export function useTimeMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot(workspaceId) });
    return queryClient.invalidateQueries({ queryKey: queryKeys.timeRoot(workspaceId) });
  };
  const options = { onSuccess: refresh, onError: (error: unknown) => notify.error(error) };
  return {
    start: useMutation({ mutationFn: (input: { taskId?: string | null; spaceId?: string | null; note?: string }) => timeApi.start(workspaceId, input), ...options }),
    stop: useMutation({ mutationFn: () => timeApi.stop(workspaceId), ...options }),
    log: useMutation({ mutationFn: (input: LogTimeRequest) => timeApi.log(workspaceId, input), ...options }),
    logBatch: useMutation({ mutationFn: (entries: LogTimeRequest[]) => timeApi.logBatch(workspaceId, entries), ...options }),
    update: useMutation({ mutationFn: ({ entryId, input }: { entryId: string; input: UpdateTimeEntryRequest }) => timeApi.update(workspaceId, entryId, input), ...options }),
    remove: useMutation({ mutationFn: (entryId: string) => timeApi.remove(workspaceId, entryId), ...options }),
  };
}

/** Open (or all) tasks to pick from when logging time, optionally only the caller's. */
export function useTaskPicker(workspaceId: string, options: { spaceId: string | null; search: string; mine: boolean; openOnly: boolean }) {
  const conditions = [
    ...(options.mine ? [{ field: 'assigneeId', op: 'eq' as const, value: '@me' }] : []),
    ...(options.openOnly ? [{ field: 'statusCategory', op: 'nin' as const, values: ['done', 'cancelled'] }] : []),
  ];
  const query = { search: options.search || null, filter: conditions.length ? { and: conditions } : null, sort: [{ field: 'updatedAt', direction: 'desc' as const }] };
  return useQuery({
    queryKey: [...queryKeys.timeRoot(workspaceId), 'pick', options],
    queryFn: () => timeApi.pickTasks(workspaceId, options.spaceId, query),
    placeholderData: (previous) => previous,
  });
}

/** Statuses for several spaces at once (the daily log shows tasks from many projects). */
export function useSpaceStatuses(workspaceId: string, spaceIds: readonly string[]) {
  const ids = [...new Set(spaceIds)].sort();
  return useQuery({
    queryKey: [...queryKeys.timeRoot(workspaceId), 'statuses', ids],
    queryFn: async () => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await timeApi.statuses(workspaceId, id)] as const))),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
}

/** Saves a daily log, then applies any status changes picked for its tasks. */
export function useSaveDailyLog(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entries, statusChanges }: { entries: LogTimeRequest[]; statusChanges: { taskId: string; statusId: string }[] }) => {
      const saved = await timeApi.logBatch(workspaceId, entries);
      for (const change of statusChanges) await timeApi.setTaskStatus(workspaceId, change.taskId, change.statusId);
      return saved;
    },
    onSuccess: (saved) => {
      notify.success(`Logged ${saved.length} ${saved.length === 1 ? 'entry' : 'entries'}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot(workspaceId) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.timeRoot(workspaceId) });
    },
    onError: (error) => notify.error(error),
  });
}
