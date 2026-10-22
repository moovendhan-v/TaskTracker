import { ArgsType, Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
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
  type UpdateLeaveTypeRequest,
} from '@taskflow/shared-types';
import { LeaveDecisionEnum, LeaveStatusEnum } from '../../../../../core/graphql/enums.js';
import { PageOf, WorkspacePageArgs } from '../../../../../core/graphql/page.type.js';

@ObjectType('LeaveType')
export class LeaveTypeGql implements LeaveTypeResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() color: string;
  @Field(() => Int, { nullable: true, description: 'null means unlimited' }) annualAllowanceDays: number | null;
  @Field() requiresApproval: boolean;
}

@InputType()
export class CreateLeaveTypeInput implements CreateLeaveTypeRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;

  @Field(() => Int, { nullable: true, description: 'null means unlimited' })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(LEAVE_ALLOWANCE_MAX)
  annualAllowanceDays: number | null;

  @Field({ nullable: true, description: 'Defaults to true' })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}

@InputType()
export class UpdateLeaveTypeInput implements UpdateLeaveTypeRequest {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(LEAVE_ALLOWANCE_MAX)
  annualAllowanceDays?: number | null;

  @Field({ nullable: true })
  @IsOptional()
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

@InputType()
export class RequestLeaveInput implements CreateLeaveRequestRequest {
  @Field(() => ID)
  @IsUUID('4')
  leaveTypeId: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsISO8601({ strict: true })
  startDate: string;

  @Field({ description: 'yyyy-mm-dd' })
  @IsISO8601({ strict: true })
  endDate: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LEAVE_REASON_MAX)
  reason?: string;
}

@InputType()
export class DecideLeaveInput implements DecideLeaveRequestRequest {
  @Field(() => LeaveDecisionEnum)
  @IsIn(LEAVE_DECISIONS)
  decision: LeaveDecision;

  @Field({ nullable: true })
  @IsOptional()
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
