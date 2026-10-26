import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { TIME_LIMITS, type LogTimeRequest, type TaskTimeSummary, type TimeEntryQuery, type TimeEntryResponse, type UpdateTimeEntryRequest } from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { IsClearable, IsOmittable, OnOrAfter, WithinDaysOf } from '../../../../core/graphql/validation.js';

@ObjectType('TimeEntryTask')
export class TimeEntryTaskGql {
  @Field(() => ID) id: string;
  @Field(() => Int) number: number;
  @Field() title: string;
}

@ObjectType('TimeEntry')
export class TimeEntryGql implements TimeEntryResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) userId: string;
  @Field(() => String, { nullable: true }) userName: string | null;
  @Field(() => ID, { nullable: true }) taskId: string | null;
  @Field(() => TimeEntryTaskGql, { nullable: true }) task: TimeEntryTaskGql | null;
  @Field(() => ID, { nullable: true }) spaceId: string | null;
  @Field(() => String, { nullable: true }) spaceName: string | null;
  @Field() startedAt: string;
  @Field(() => String, { nullable: true, description: 'Null while the timer runs' }) endedAt: string | null;
  @Field(() => Int, { description: 'For a running timer: the minutes so far' }) minutes: number;
  @Field() note: string;
  @Field() activity: string;
}

@ObjectType('TaskTimeSummary')
export class TaskTimeSummaryGql implements TaskTimeSummary {
  @Field(() => ID) taskId: string;
  @Field(() => Int) totalMinutes: number;
  @Field(() => Int) myMinutes: number;
  @Field(() => Int) entryCount: number;
}

@InputType('StartTimerInput')
export class StartTimerInput {
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') taskId?: string | null;
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') spaceId?: string | null;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TIME_LIMITS.noteMax) note?: string;
}

@FormSchema('time.log')
@InputType('LogTimeInput')
export class LogTimeInput implements LogTimeRequest {
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') taskId?: string | null;
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') spaceId?: string | null;
  @Field() @IsISO8601({ strict: true }) startedAt: string;
  @Field() @IsISO8601({ strict: true }) @OnOrAfter('startedAt') @WithinDaysOf('startedAt', 1) endedAt: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TIME_LIMITS.noteMax) note?: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TIME_LIMITS.activityMax) activity?: string;
}

@InputType('LogTimeBatchInput')
export class LogTimeBatchInput {
  @Field(() => [LogTimeInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TIME_LIMITS.batchMax)
  @ValidateNested({ each: true })
  @Type(() => LogTimeInput)
  entries: LogTimeInput[];
}

@FormSchema('time.update')
@InputType('UpdateTimeEntryInput')
export class UpdateTimeEntryInput implements UpdateTimeEntryRequest {
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') taskId?: string | null;
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') spaceId?: string | null;
  @Field({ nullable: true }) @IsOmittable() @IsISO8601({ strict: true }) startedAt?: string;
  @Field({ nullable: true }) @IsOmittable() @IsISO8601({ strict: true }) @OnOrAfter('startedAt') endedAt?: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TIME_LIMITS.noteMax) note?: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TIME_LIMITS.activityMax) activity?: string;
}

@InputType('TimeEntryQueryInput')
export class TimeEntryQueryInput implements TimeEntryQuery {
  @Field() @IsISO8601({ strict: true }) from: string;
  @Field() @IsISO8601({ strict: true }) to: string;
  @Field(() => [ID], { nullable: true, description: "Others' entries need time.view_all" })
  @IsOmittable()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  userIds?: string[];
  @Field(() => ID, { nullable: true }) @IsOmittable() @IsUUID('4') spaceId?: string;
  @Field(() => ID, { nullable: true }) @IsOmittable() @IsUUID('4') taskId?: string;
}
