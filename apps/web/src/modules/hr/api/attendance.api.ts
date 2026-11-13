import { ClockInDocument, ClockOutDocument, CorrectAttendanceShiftDocument, EndBreakDocument, ExportAttendanceDocument, MyAttendanceDocument, StartBreakDocument, TeamAttendanceDocument } from '@taskflow/sdk';
import type { CorrectAttendanceShiftInput } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** Your clock and the team's. Clocking sends no times (the server's clock decides); only HR's corrections do. */
export const attendanceApi = {
  mine: async (workspaceId: string) => (await graphql(MyAttendanceDocument, { workspaceId })).myAttendance,
  team: async (workspaceId: string, from: string, to: string) => (await graphql(TeamAttendanceDocument, { workspaceId, from, to })).teamAttendance,
  clockIn: async (workspaceId: string) => (await graphql(ClockInDocument, { workspaceId })).clockIn,
  clockOut: async (workspaceId: string) => (await graphql(ClockOutDocument, { workspaceId })).clockOut,
  startBreak: async (workspaceId: string) => (await graphql(StartBreakDocument, { workspaceId })).startBreak,
  endBreak: async (workspaceId: string) => (await graphql(EndBreakDocument, { workspaceId })).endBreak,
  export: async (workspaceId: string, from: string, to: string, timeZone: string) => (await graphql(ExportAttendanceDocument, { workspaceId, from, to, timeZone })).exportAttendance,
  correct: async (workspaceId: string, shiftId: string, input: CorrectAttendanceShiftInput) => (await graphql(CorrectAttendanceShiftDocument, { workspaceId, shiftId, input })).correctAttendanceShift,
};
