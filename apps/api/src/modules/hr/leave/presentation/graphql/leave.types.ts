import { ArgsType, Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  COLOR_PATTERN,
  LEAVE_ALLOWANCE_MAX,
  LEAVE_DECISIONS,
  LEAVE_REASON_MAX,
  LEAVE_STATUSES,
  NAME_MAX,
  type CreateLeaveRequestRequest,
  type CreateLeaveTypeRequest,
  type DecideLeaveRequestRequest,
  type LeaveBalanceResponse,
  type LeaveDecision,
  type LeaveRequestResponse,
  type LeaveStatus,
  type LeaveTypeResponse,
  type TeamAbsenceResponse,
  type UpdateLeaveTypeRequest,
} from '@taskflow/shared-types';
import { LeaveDecisionEnum, LeaveStatusEnum } from '../../../../../core/graphql/enums.js';
import { PageOf, WorkspacePageArgs } from '../../../../../core/graphql/page.type.js';
import { IsCalendarDate, IsClearable, IsNotBlank, IsNullable, IsOmittable, OnOrAfter } from '../../../../../core/graphql/validation.js';
import { FormSchema } from '../../../../../core/forms/form-schema.decorators.js';

@ObjectType('LeaveType')
export class LeaveTypeGql implements LeaveTypeResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() color: string;
  @Field(() => Int, { nullable: true, description: 'null means unlimited' }) annualAllowanceDays: number | null;
  @Field() requiresApproval: boolean;
}

@FormSchema('hr.leaveType.create')
@InputType()
export class CreateLeaveTypeInput implements CreateLeaveTypeRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOmittable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;

  @Field(() => Int, { nullable: true, description: 'null means unlimited' })
  @IsNullable()
  @IsInt()
  @Min(0)
  @Max(LEAVE_ALLOWANCE_MAX)
  annualAllowanceDays: number | null;

  @Field({ nullable: true, description: 'Defaults to true' })
  @IsOmittable()
  @IsBoolean()
  requiresApproval?: boolean;
}

@FormSchema('hr.leaveType.update')
@InputType()
export class UpdateLeaveTypeInput implements UpdateLeaveTypeRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;

  @Field(() => Int, { nullable: true })
  @IsClearable()
  @IsInt()
  @Min(0)
  @Max(LEAVE_ALLOWANCE_MAX)
  annualAllowanceDays?: number | null;

  @Field({ nullable: true })
  @IsOmittable()
  @IsBoolean()
  requiresApproval?: boolean;
}



@ObjectType('LeaveRequest')
export class LeaveRequestGql implements LeaveRequestResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) userId: string;
  @Field() userName: string;
  @Field(() => ID) leaveTypeId: string;
  @Field() leaveTypeName: string;
  @Field({ description: 'yyyy-mm-dd' }) startDate: string;
  @Field({ description: 'yyyy-mm-dd' }) endDate: string;
  @Field(() => Int, { description: 'Working days' }) days: number;
  @Field() reason: string;
  @Field(() => LeaveStatusEnum) status: LeaveStatus;
  @Field(() => ID, { nullable: true }) decidedById: string | null;
  @Field(() => String, { nullable: true }) decidedAt: string | null;
  @Field() decisionNote: string;
  @Field() createdAt: string;
}

@ObjectType('LeaveRequestPage')
export class LeaveRequestPageGql extends PageOf(LeaveRequestGql) {}

@ArgsType()
export class LeaveQueueArgs extends WorkspacePageArgs {
  @Field(() => LeaveStatusEnum, { nullable: true })
  @IsOptional()
  @IsIn(LEAVE_STATUSES)
  status?: LeaveStatus;
}

@FormSchema('hr.leave.request')
@InputType()
export class RequestLeaveInput implements CreateLeaveRequestRequest {
  @Field(() => ID)
  @IsUUID('4')
  leaveTypeId: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsCalendarDate()
  startDate: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsCalendarDate()
  @OnOrAfter('startDate')
  endDate: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(LEAVE_REASON_MAX)
  reason?: string;
}

@FormSchema('hr.leave.decide')
@InputType()
export class DecideLeaveInput implements DecideLeaveRequestRequest {
  @Field(() => LeaveDecisionEnum)
  @IsIn(LEAVE_DECISIONS)
  decision: LeaveDecision;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(LEAVE_REASON_MAX)
  note?: string;
}

@ObjectType('LeaveBalance')
export class LeaveBalanceGql implements LeaveBalanceResponse {
  @Field(() => ID) leaveTypeId: string;
  @Field() leaveTypeName: string;
  @Field() color: string;
  @Field(() => Int) year: number;
  @Field(() => Int, { nullable: true, description: 'null means unlimited' }) allowanceDays: number | null;
  @Field(() => Int) usedDays: number;
  @Field(() => Int) pendingDays: number;
  @Field(() => Int, { nullable: true }) remainingDays: number | null;
}

@ObjectType('TeamAbsence', { description: 'Approved leave, dates only: no type, reason or notes' })
export class TeamAbsenceGql implements TeamAbsenceResponse {
  @Field(() => ID) userId: string;
  @Field({ description: 'yyyy-mm-dd' }) startDate: string;
  @Field({ description: 'yyyy-mm-dd' }) endDate: string;
}
