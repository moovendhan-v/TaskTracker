import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_LIMITS,
  AUTOMATION_TRIGGERS,
  NOTIFY_AUDIENCES,
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  TASK_TYPES,
  type AutomationAction,
  type AutomationActionType,
  type AutomationConditions,
  type AutomationRuleResponse,
  type AutomationRunResponse,
  type AutomationRunStatus,
  type AutomationTrigger,
  type AutomationTriggerType,
  type NotifyAudience,
  type SaveAutomationRequest,
  type StatusCategory,
  type TaskPriority,
  type TaskType,
  FLOW_LIMITS,
  type AutomationFlow,
  type FlowTraceEntry,
  type FlowTraceOutcome,
} from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import {
  AutomationActionEnum,
  AutomationRunStatusEnum,
  AutomationTriggerEnum,
  NotifyAudienceEnum,
  StatusCategoryEnum,
  TaskPriorityEnum,
  TaskTypeEnum,
} from '../../../../core/graphql/enums.js';
import { IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

const IDS = AUTOMATION_LIMITS.idsMax;

@ObjectType('AutomationTrigger')
export class AutomationTriggerGql implements AutomationTrigger {
  @Field(() => AutomationTriggerEnum) type: AutomationTriggerType;
  @Field(() => [ID], { nullable: true }) statusIds?: string[] | null;
  @Field(() => [StatusCategoryEnum], { nullable: true }) categories?: StatusCategory[] | null;
  @Field(() => [TaskPriorityEnum], { nullable: true }) priorities?: TaskPriority[] | null;
  @Field(() => Int, { nullable: true, description: 'task_due_soon: days ahead (0 = due today)' }) days?: number | null;
}

@ObjectType('AutomationConditions')
export class AutomationConditionsGql implements AutomationConditions {
  @Field(() => [ID], { nullable: true }) listIds?: string[] | null;
  @Field(() => [TaskPriorityEnum], { nullable: true }) priorities?: TaskPriority[] | null;
  @Field(() => [TaskTypeEnum], { nullable: true }) types?: TaskType[] | null;
}

@ObjectType('AutomationAction')
export class AutomationActionGql implements AutomationAction {
  @Field(() => AutomationActionEnum) type: AutomationActionType;
  @Field(() => ID, { nullable: true }) statusId?: string | null;
  @Field(() => TaskPriorityEnum, { nullable: true }) priority?: TaskPriority | null;
  @Field(() => String, { nullable: true }) userId?: string | null;
  @Field(() => [NotifyAudienceEnum], { nullable: true }) audiences?: NotifyAudience[] | null;
  @Field(() => [String], { nullable: true }) userIds?: string[] | null;
  @Field(() => String, { nullable: true }) message?: string | null;
  @Field(() => Int, { nullable: true, description: 'set_due_date: days from the day it runs; null clears' }) days?: number | null;
  @Field(() => ID, { nullable: true, description: 'post_chat: the channel' }) channelId?: string | null;
  @Field(() => String, { nullable: true, description: 'webhook: an https URL on an allowlisted host' }) url?: string | null;
}

@ObjectType('AutomationRule')
export class AutomationRuleGql implements AutomationRuleResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field() enabled: boolean;
  @Field(() => AutomationTriggerGql) trigger: AutomationTriggerGql;
  @Field(() => AutomationConditionsGql) conditions: AutomationConditionsGql;
  @Field(() => [AutomationActionGql]) actions: AutomationActionGql[];
  /** Exposed as flowJson (see the resolver): a recursive tree reads better as JSON. */
  flow: AutomationFlow | null;
  @Field(() => String, { nullable: true, description: 'Who the rule runs as' }) createdById: string | null;
  @Field(() => Int) runCount: number;
  @Field(() => String, { nullable: true }) lastRunAt: string | null;
  @Field() createdAt: string;
}

@ObjectType('AutomationRunStep')
export class AutomationRunStepGql implements FlowTraceEntry {
  @Field() stepId: string;
  @Field(() => String, { description: 'ran, took-yes, took-no, stopped, failed or waited' }) outcome: FlowTraceOutcome;
  @Field() detail: string;
}

@ObjectType('AutomationRun')
export class AutomationRunGql implements AutomationRunResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) ruleId: string;
  @Field(() => ID, { nullable: true }) taskId: string | null;
  @Field(() => AutomationRunStatusEnum) status: AutomationRunStatus;
  @Field() message: string;
  @Field(() => [AutomationRunStepGql], { description: 'The steps this run reached, in order' }) trace: AutomationRunStepGql[];
  @Field(() => String, { nullable: true, description: 'A waiting run: when it carries on' }) resumesAt: string | null;
  @Field() createdAt: string;
}

@InputType('AutomationTriggerInput')
export class AutomationTriggerInput implements AutomationTrigger {
  @Field(() => AutomationTriggerEnum) @IsIn(AUTOMATION_TRIGGERS) type: AutomationTriggerType;
  @Field(() => [ID], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(IDS) @IsUUID('4', { each: true }) statusIds?: string[] | null;
  @Field(() => [StatusCategoryEnum], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(IDS) @IsIn(STATUS_CATEGORIES, { each: true }) categories?: StatusCategory[] | null;
  @Field(() => [TaskPriorityEnum], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(IDS) @IsIn(TASK_PRIORITIES, { each: true }) priorities?: TaskPriority[] | null;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(0) @Max(AUTOMATION_LIMITS.dueSoonDaysMax) days?: number | null;
}

@InputType('AutomationConditionsInput')
export class AutomationConditionsInput implements AutomationConditions {
  @Field(() => [ID], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(IDS) @IsUUID('4', { each: true }) listIds?: string[] | null;
  @Field(() => [TaskPriorityEnum], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(IDS) @IsIn(TASK_PRIORITIES, { each: true }) priorities?: TaskPriority[] | null;
  @Field(() => [TaskTypeEnum], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(IDS) @IsIn(TASK_TYPES, { each: true }) types?: TaskType[] | null;
}

@InputType('AutomationActionInput')
export class AutomationActionInput implements AutomationAction {
  @Field(() => AutomationActionEnum) @IsIn(AUTOMATION_ACTIONS) type: AutomationActionType;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') statusId?: string | null;
  @Field(() => TaskPriorityEnum, { nullable: true }) @IsOptional() @IsIn(TASK_PRIORITIES) priority?: TaskPriority | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(64) userId?: string | null;
  @Field(() => [NotifyAudienceEnum], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(NOTIFY_AUDIENCES.length) @IsIn(NOTIFY_AUDIENCES, { each: true }) audiences?: NotifyAudience[] | null;
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(IDS) @IsString({ each: true }) @MaxLength(64, { each: true }) userIds?: string[] | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(AUTOMATION_LIMITS.messageMax) message?: string | null;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(0) @Max(FLOW_LIMITS.daysMax) days?: number | null;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') channelId?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(AUTOMATION_LIMITS.urlMax) url?: string | null;
}

@FormSchema('automation.save')
@InputType('SaveAutomationInput')
export class SaveAutomationInput implements SaveAutomationRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(AUTOMATION_LIMITS.nameMax) name: string;
  @Field({ nullable: true }) @IsOmittable() @IsBoolean() enabled?: boolean;
  @Field(() => AutomationTriggerInput) @ValidateNested() @Type(() => AutomationTriggerInput) trigger: AutomationTriggerInput;
  @Field(() => AutomationConditionsInput, { nullable: true }) @IsOmittable() @ValidateNested() @Type(() => AutomationConditionsInput) conditions?: AutomationConditionsInput;
  @Field(() => [AutomationActionInput])
  @IsArray()
  @ArrayMaxSize(AUTOMATION_LIMITS.actionsMax)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionInput)
  actions: AutomationActionInput[];

  @Field(() => String, { nullable: true, description: 'A flow (JSON): when set it decides what runs, and conditions / actions are ignored' })
  @IsOptional()
  @IsString()
  @MaxLength(FLOW_LIMITS.jsonMax)
  flowJson?: string | null;
}
