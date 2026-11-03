import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { AttendanceBreak, AttendanceShiftResponse, MyAttendanceResponse } from '@taskflow/shared-types';

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
}

@ObjectType('MyAttendance')
export class MyAttendanceGql implements MyAttendanceResponse {
  @Field(() => AttendanceShiftGql, { nullable: true }) current: AttendanceShiftGql | null;
  @Field(() => [AttendanceShiftGql]) recent: AttendanceShiftGql[];
}
