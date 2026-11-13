import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../../core/graphql/args.js';
import { cappedListComplexity } from '../../../../../core/graphql/page.type.js';
import { CurrentActor } from '../../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../../core/http/types/authenticated-request.js';
import { AttendanceService } from '../../application/attendance.service.js';
import { AttendanceExportGql, AttendanceShiftGql, CorrectAttendanceShiftGqlInput, MyAttendanceGql } from './attendance.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/**
 * Attendance: your own clock (time.log) and the team's (hr.manage). Every change
 * is the caller's own, at the server's time; nothing in the request says who or when.
 */
@Resolver()
export class AttendanceResolver {
  constructor(private readonly attendance: AttendanceService) {}

  @Query(() => MyAttendanceGql, { description: 'Whether you are clocked in, and your recent shifts' })
  @RequirePermissions('time.log')
  myAttendance(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<MyAttendanceGql> {
    return this.attendance.mine(access.workspaceId, actor.userId);
  }

  @Mutation(() => AttendanceShiftGql)
  @RequirePermissions('time.log')
  @Throttle(PER_MINUTE(20))
  clockIn(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AttendanceShiftGql> {
    return this.attendance.clockIn(access.workspaceId, actor.userId);
  }

  @Mutation(() => AttendanceShiftGql)
  @RequirePermissions('time.log')
  @Throttle(PER_MINUTE(20))
  startBreak(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AttendanceShiftGql> {
    return this.attendance.startBreak(access.workspaceId, actor.userId);
  }

  @Mutation(() => AttendanceShiftGql)
  @RequirePermissions('time.log')
  @Throttle(PER_MINUTE(20))
  endBreak(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AttendanceShiftGql> {
    return this.attendance.endBreak(access.workspaceId, actor.userId);
  }

  @Mutation(() => AttendanceShiftGql, { description: 'Ends your shift, and a running break with it' })
  @RequirePermissions('time.log')
  @Throttle(PER_MINUTE(20))
  clockOut(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AttendanceShiftGql> {
    return this.attendance.clockOut(access.workspaceId, actor.userId);
  }

  @Query(() => [AttendanceShiftGql], { complexity: cappedListComplexity(400), description: 'Everyone’s shifts that overlap the range (at most 31 days and 400 shifts)' })
  @RequirePermissions('hr.manage')
  teamAttendance(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('from', { description: 'ISO date-time' }) from: string,
    @Args('to', { description: 'ISO date-time, exclusive' }) to: string,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AttendanceShiftGql[]> {
    return this.attendance.team(access.workspaceId, from, to);
  }

  @Mutation(() => AttendanceExportGql, { description: 'Everyone’s shifts in the range as CSV, in your time zone (at most 31 days). Audited' })
  @RequirePermissions('hr.manage')
  @Throttle(PER_MINUTE(5))
  exportAttendance(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('from', { description: 'ISO date-time' }) from: string,
    @Args('to', { description: 'ISO date-time, exclusive' }) to: string,
    @Args('timeZone', { description: 'IANA time zone, e.g. Europe/Berlin' }) timeZone: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AttendanceExportGql> {
    return this.attendance.exportCsv(actor, access.workspaceId, from, to, timeZone);
  }

  @Mutation(() => AttendanceShiftGql, { description: 'HR fixes a shift’s times, saying why. Audited' })
  @RequirePermissions('hr.manage')
  @Throttle(PER_MINUTE(30))
  correctAttendanceShift(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('shiftId') shiftId: string,
    @Args('input') input: CorrectAttendanceShiftGqlInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AttendanceShiftGql> {
    return this.attendance.correct(actor, access.workspaceId, shiftId, input);
  }
}
