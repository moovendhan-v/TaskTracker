import { ClockInDocument, ClockOutDocument, EndBreakDocument, MyAttendanceDocument, StartBreakDocument, TeamAttendanceDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Your clock and the team's. The server sets every time; nothing here sends one. */
export const attendanceApi = {
  mine: async (workspaceId: string) => (await graphql(MyAttendanceDocument, { workspaceId })).myAttendance,
  team: async (workspaceId: string, from: string, to: string) => (await graphql(TeamAttendanceDocument, { workspaceId, from, to })).teamAttendance,
  clockIn: async (workspaceId: string) => (await graphql(ClockInDocument, { workspaceId })).clockIn,
  clockOut: async (workspaceId: string) => (await graphql(ClockOutDocument, { workspaceId })).clockOut,
  startBreak: async (workspaceId: string) => (await graphql(StartBreakDocument, { workspaceId })).startBreak,
  endBreak: async (workspaceId: string) => (await graphql(EndBreakDocument, { workspaceId })).endBreak,
};
