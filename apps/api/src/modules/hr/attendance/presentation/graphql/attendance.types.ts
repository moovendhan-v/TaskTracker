import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsISO8601, IsString, MaxLength } from 'class-validator';
import { ATTENDANCE_LIMITS, type AttendanceBreak, type AttendanceExportResponse, type AttendanceShiftResponse, type CorrectAttendanceShiftInput, type MyAttendanceResponse } from '@taskflow/shared-types';

@ObjectType('AttendanceBreak')
export class AttendanceBreakGql implements AttendanceBreak {
  @Field() start: string;
  @Field(() => String, { nullable: true, description: 'Null while the break is running' }) end: string | null;
}

@ObjectType('AttendanceShift', { description: 'One clocked shift: in, breaks, out. Times are the server’s' })
export class AttendanceShiftGql implements AttendanceShiftResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) userId: string;
  @Field() startedAt: string;
  @Field(() => String, { nullable: true, description: 'Null while clocked in' }) endedAt: string | null;
  @Field(() => [AttendanceBreakGql]) breaks: AttendanceBreakGql[];
  @Field() onBreak: boolean;
  @Field(() => Int, { description: 'Worked so far: length minus breaks' }) workedMinutes: number;
  @Field(() => String, { nullable: true, description: 'When HR corrected the times' }) correctedAt: string | null;
  @Field(() => ID, { nullable: true }) correctedById: string | null;
  @Field(() => String, { nullable: true }) correctionReason: string | null;
}

@InputType('CorrectAttendanceShiftInput')
export class CorrectAttendanceShiftGqlInput implements CorrectAttendanceShiftInput {
  @Field({ description: 'ISO date-time' }) @IsISO8601({ strict: true }) startedAt: string;
  @Field({ description: 'ISO date-time; not in the future' }) @IsISO8601({ strict: true }) endedAt: string;
  @Field() @IsString() @MaxLength(ATTENDANCE_LIMITS.correctionReasonMax * 2) reason: string;
}

@ObjectType('AttendanceExport', { description: 'The team’s shifts as a CSV file' })
export class AttendanceExportGql implements AttendanceExportResponse {
  @Field() fileName: string;
  @Field() content: string;
  @Field(() => Int) shifts: number;
  @Field() truncated: boolean;
}

@ObjectType('MyAttendance')
export class MyAttendanceGql implements MyAttendanceResponse {
  @Field(() => AttendanceShiftGql, { nullable: true }) current: AttendanceShiftGql | null;
  @Field(() => [AttendanceShiftGql]) recent: AttendanceShiftGql[];
}
