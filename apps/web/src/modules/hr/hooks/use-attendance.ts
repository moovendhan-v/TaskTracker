import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/kit/notify';
import { queryKeys } from '@/lib/query-keys';
import type { CorrectAttendanceShiftInput } from '@taskflow/shared-types';
import { attendanceApi } from '../api/attendance.api';

const key = (workspaceId: string) => [...queryKeys.hrRoot(workspaceId), 'attendance'] as const;

export function useMyAttendance(workspaceId: string) {
  return useQuery({ queryKey: [...key(workspaceId), 'mine'], queryFn: () => attendanceApi.mine(workspaceId) });
}

export function useTeamAttendance(workspaceId: string, from: string, to: string, enabled: boolean) {
  return useQuery({ queryKey: [...key(workspaceId), 'team', from, to], queryFn: () => attendanceApi.team(workspaceId, from, to), enabled });
}

export function useClock(workspaceId: string) {
  const queryClient = useQueryClient();
  const settle = { onSettled: () => queryClient.invalidateQueries({ queryKey: key(workspaceId) }), onError: (error: unknown) => notify.error(error) };
  return {
    clockIn: useMutation({ mutationFn: () => attendanceApi.clockIn(workspaceId), ...settle }),
    clockOut: useMutation({ mutationFn: () => attendanceApi.clockOut(workspaceId), ...settle }),
    startBreak: useMutation({ mutationFn: () => attendanceApi.startBreak(workspaceId), ...settle }),
    endBreak: useMutation({ mutationFn: () => attendanceApi.endBreak(workspaceId), ...settle }),
  };
}

/** HR's fix to someone's shift; refreshes every attendance view. */
export function useCorrectShift(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, input }: { shiftId: string; input: CorrectAttendanceShiftInput }) => attendanceApi.correct(workspaceId, shiftId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
