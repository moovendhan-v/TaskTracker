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
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });

export const departmentsApi = {
  list: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/hr/departments', ws(workspaceId))),
  create: (workspaceId: string, body: CreateDepartmentRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/hr/departments', { ...ws(workspaceId), body })),
  update: (workspaceId: string, departmentId: string, body: UpdateDepartmentRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/hr/departments/{departmentId}', { params: { path: { workspaceId, departmentId } }, body })),
  remove: (workspaceId: string, departmentId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/hr/departments/{departmentId}', { params: { path: { workspaceId, departmentId } } })),
};

export const employeesApi = {
  directory: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/hr/employees', ws(workspaceId))),
  upsert: (workspaceId: string, userId: string, body: UpsertEmployeeProfileRequest) =>
    unwrap(api.PUT('/api/workspaces/{workspaceId}/hr/employees/{userId}', { params: { path: { workspaceId, userId } }, body })),
};

export const leaveTypesApi = {
  list: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/hr/leave-types', ws(workspaceId))),
  create: (workspaceId: string, body: CreateLeaveTypeRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/hr/leave-types', { ...ws(workspaceId), body })),
  update: (workspaceId: string, leaveTypeId: string, body: UpdateLeaveTypeRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/hr/leave-types/{leaveTypeId}', { params: { path: { workspaceId, leaveTypeId } }, body })),
  remove: (workspaceId: string, leaveTypeId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/hr/leave-types/{leaveTypeId}', { params: { path: { workspaceId, leaveTypeId } } })),
};

export const leaveRequestsApi = {
  mine: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/hr/leave-requests/mine', ws(workspaceId))),
  queue: (workspaceId: string, status: LeaveStatus | undefined) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/hr/leave-requests', { params: { path: { workspaceId }, query: { status, pageSize: 100 } } })),
  create: (workspaceId: string, body: CreateLeaveRequestRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/hr/leave-requests', { ...ws(workspaceId), body })),
  decide: (workspaceId: string, requestId: string, body: DecideLeaveRequestRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/hr/leave-requests/{requestId}/decide', { params: { path: { workspaceId, requestId } }, body })),
  cancel: (workspaceId: string, requestId: string) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/hr/leave-requests/{requestId}/cancel', { params: { path: { workspaceId, requestId } } })),
  myBalances: (workspaceId: string, year: number) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/hr/leave-balances/mine', { params: { path: { workspaceId }, query: { year } } })),
};
