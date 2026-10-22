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
import {
  CancelLeaveRequestDocument,
  CreateDepartmentDocument,
  CreateLeaveTypeDocument,
  DecideLeaveRequestDocument,
  DeleteDepartmentDocument,
  DeleteLeaveTypeDocument,
  DepartmentsDocument,
  EmployeesDocument,
  LeaveRequestsDocument,
  LeaveTypesDocument,
  MyLeaveBalancesDocument,
  MyLeaveRequestsDocument,
  RequestLeaveDocument,
  UpdateDepartmentDocument,
  UpdateLeaveTypeDocument,
  UpsertEmployeeProfileDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** The approver queue shows one page of this size. */
const LEAVE_QUEUE_PAGE_SIZE = 100;

export const departmentsApi = {
  list: async (workspaceId: string) => (await graphql(DepartmentsDocument, { workspaceId })).departments,
  create: async (workspaceId: string, input: CreateDepartmentRequest) =>
    (await graphql(CreateDepartmentDocument, { workspaceId, input })).createDepartment,
  update: async (workspaceId: string, departmentId: string, input: UpdateDepartmentRequest) =>
    (await graphql(UpdateDepartmentDocument, { workspaceId, departmentId, input })).updateDepartment,
  remove: async (workspaceId: string, departmentId: string) =>
    (await graphql(DeleteDepartmentDocument, { workspaceId, departmentId })).deleteDepartment,
};

export const employeesApi = {
  directory: async (workspaceId: string) => (await graphql(EmployeesDocument, { workspaceId })).employees,
  upsert: async (workspaceId: string, userId: string, input: UpsertEmployeeProfileRequest) =>
    (await graphql(UpsertEmployeeProfileDocument, { workspaceId, userId, input })).upsertEmployeeProfile,
};

export const leaveTypesApi = {
  list: async (workspaceId: string) => (await graphql(LeaveTypesDocument, { workspaceId })).leaveTypes,
  create: async (workspaceId: string, input: CreateLeaveTypeRequest) =>
    (await graphql(CreateLeaveTypeDocument, { workspaceId, input })).createLeaveType,
  update: async (workspaceId: string, leaveTypeId: string, input: UpdateLeaveTypeRequest) =>
    (await graphql(UpdateLeaveTypeDocument, { workspaceId, leaveTypeId, input })).updateLeaveType,
  remove: async (workspaceId: string, leaveTypeId: string) =>
    (await graphql(DeleteLeaveTypeDocument, { workspaceId, leaveTypeId })).deleteLeaveType,
};

export const leaveRequestsApi = {
  mine: async (workspaceId: string) => (await graphql(MyLeaveRequestsDocument, { workspaceId })).myLeaveRequests,
  queue: async (workspaceId: string, status: LeaveStatus | undefined) =>
    (await graphql(LeaveRequestsDocument, { workspaceId, status, pageSize: LEAVE_QUEUE_PAGE_SIZE })).leaveRequests,
  create: async (workspaceId: string, input: CreateLeaveRequestRequest) =>
    (await graphql(RequestLeaveDocument, { workspaceId, input })).requestLeave,
  decide: async (workspaceId: string, requestId: string, input: DecideLeaveRequestRequest) =>
    (await graphql(DecideLeaveRequestDocument, { workspaceId, requestId, input })).decideLeaveRequest,
  cancel: async (workspaceId: string, requestId: string) =>
    (await graphql(CancelLeaveRequestDocument, { workspaceId, requestId })).cancelLeaveRequest,
  myBalances: async (workspaceId: string, year: number) =>
    (await graphql(MyLeaveBalancesDocument, { workspaceId, year })).myLeaveBalances,
};
