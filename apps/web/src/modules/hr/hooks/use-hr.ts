import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDepartmentRequest,
  CreateLeaveRequestRequest,
  CreateLeaveTypeRequest,
  DecideLeaveRequestRequest,
  LeaveStatus,
  UpdateDepartmentRequest,
  UpdateLeaveTypeRequest,
  UpsertEmployeeProfileRequest,
} from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { departmentsApi, employeesApi, leaveRequestsApi, leaveTypesApi } from '../api/hr.api';

const onError = (error: unknown) => toast.error(getErrorMessage(error));

/** Every HR change can affect counts, balances and queues, so mutations refresh the whole HR cache. */
function useInvalidateHr(workspaceId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.hrRoot(workspaceId) });
}

export function useDepartments(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.departments(workspaceId), queryFn: () => departmentsApi.list(workspaceId) });
}

export function useEmployees(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.employees(workspaceId), queryFn: () => employeesApi.directory(workspaceId) });
}

export function useLeaveTypes(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.leaveTypes(workspaceId), queryFn: () => leaveTypesApi.list(workspaceId) });
}

export function useMyLeave(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.myLeave(workspaceId), queryFn: () => leaveRequestsApi.mine(workspaceId) });
}

export function useLeaveCalendar(workspaceId: string, from: string, to: string, enabled = true) {
  return useQuery({ queryKey: [...queryKeys.hrRoot(workspaceId), 'leave', 'calendar', from, to], queryFn: () => leaveRequestsApi.calendar(workspaceId, from, to), enabled });
}

export function useLeaveQueue(workspaceId: string, status: LeaveStatus | undefined) {
  return useQuery({ queryKey: queryKeys.leaveQueue(workspaceId, status ?? 'all'), queryFn: () => leaveRequestsApi.queue(workspaceId, status) });
}

export function useMyBalances(workspaceId: string, year: number) {
  return useQuery({ queryKey: queryKeys.myBalances(workspaceId, year), queryFn: () => leaveRequestsApi.myBalances(workspaceId, year) });
}

export function useDepartmentMutations(workspaceId: string) {
  const onSuccess = useInvalidateHr(workspaceId);
  return {
    create: useMutation({ mutationFn: (body: CreateDepartmentRequest) => departmentsApi.create(workspaceId, body), onSuccess, onError }),
    update: useMutation({
      mutationFn: ({ departmentId, body }: { departmentId: string; body: UpdateDepartmentRequest }) =>
        departmentsApi.update(workspaceId, departmentId, body),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: (departmentId: string) => departmentsApi.remove(workspaceId, departmentId), onSuccess, onError }),
  };
}

export function useUpsertProfile(workspaceId: string) {
  const onSuccess = useInvalidateHr(workspaceId);
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: UpsertEmployeeProfileRequest }) => employeesApi.upsert(workspaceId, userId, body),
    onSuccess,
    onError,
  });
}

export function useLeaveTypeMutations(workspaceId: string) {
  const onSuccess = useInvalidateHr(workspaceId);
  return {
    create: useMutation({ mutationFn: (body: CreateLeaveTypeRequest) => leaveTypesApi.create(workspaceId, body), onSuccess, onError }),
    update: useMutation({
      mutationFn: ({ leaveTypeId, body }: { leaveTypeId: string; body: UpdateLeaveTypeRequest }) =>
        leaveTypesApi.update(workspaceId, leaveTypeId, body),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: (leaveTypeId: string) => leaveTypesApi.remove(workspaceId, leaveTypeId), onSuccess, onError }),
  };
}

export function useLeaveMutations(workspaceId: string) {
  const onSuccess = useInvalidateHr(workspaceId);
  return {
    request: useMutation({ mutationFn: (body: CreateLeaveRequestRequest) => leaveRequestsApi.create(workspaceId, body), onSuccess, onError }),
    decide: useMutation({
      mutationFn: ({ requestId, body }: { requestId: string; body: DecideLeaveRequestRequest }) =>
        leaveRequestsApi.decide(workspaceId, requestId, body),
      onSuccess,
      onError,
    }),
    cancel: useMutation({ mutationFn: (requestId: string) => leaveRequestsApi.cancel(workspaceId, requestId), onSuccess, onError }),
  };
}
