import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import {
  BUG_ENVIRONMENTS,
  BUG_KINDS,
  BUG_LIMITS,
  BUG_QA_STATES,
  BUG_SEVERITIES,
  type BugEnvironment,
  type BugFilter,
  type BugKind,
  type BugQaState,
  type BugResponse,
  type BugSeverity,
  type BugSource,
  type BugStep,
  type SimilarBugResponse,
  type TaskPriority,
} from '@taskflow/shared-types';

@ObjectType('BugStep')
export class BugStepGql implements BugStep {
  @Field() text: string;
  @Field(() => String, { description: 'manual or captured' }) source: 'manual' | 'captured';
}

@ObjectType('Bug', { description: 'A visual bug report: a task of type bug with QA details and captured diagnostics' })
export class BugGql implements BugResponse {
  @Field(() => ID) taskId: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field(() => ID) spaceId: string;
  @Field(() => ID) listId: string;
  @Field() statusName: string;
  @Field() statusCategory: string;
  @Field(() => String) priority: TaskPriority;
  @Field(() => [ID]) assigneeIds: string[];
  @Field(() => String) kind: BugKind;
  @Field(() => String) severity: BugSeverity;
  @Field(() => String) environment: BugEnvironment;
  @Field(() => String, { nullable: true }) module: string | null;
  @Field() expected: string;
  @Field() actual: string;
  @Field(() => [BugStepGql]) steps: BugStepGql[];
  @Field(() => String) qaState: BugQaState;
  @Field(() => String) source: BugSource;
  @Field(() => String, { nullable: true }) pageUrl: string | null;
  @Field(() => String, { nullable: true }) browser: string | null;
  @Field(() => String, { nullable: true }) os: string | null;
  @Field(() => String, { nullable: true }) viewport: string | null;
  @Field(() => ID, { nullable: true }) reporterId: string | null;
  @Field(() => String, { nullable: true, description: 'For reports from outside the workspace (portal, SDK)' }) reporterName: string | null;
  @Field(() => ID, { nullable: true }) duplicateOfTaskId: string | null;
  @Field(() => Int) consoleErrors: number;
  @Field(() => Int) failedRequests: number;
  @Field() createdAt: string;
  @Field() updatedAt: string;
}

@ObjectType('SimilarBug')
export class SimilarBugGql implements SimilarBugResponse {
  @Field(() => ID) taskId: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field(() => String) qaState: BugQaState;
  @Field({ description: 'Title similarity, 0–1' }) score: number;
}

@InputType()
export class BugContextInput {
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(BUG_LIMITS.url) pageUrl?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(120) browser?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(120) os?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(20) viewport?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(500) userAgent?: string | null;
}

@InputType()
export class ReportBugInput {
  @Field(() => ID) @IsUUID('4') spaceId: string;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') listId?: string | null;
  @Field() @IsString() @MaxLength(BUG_LIMITS.title) title: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(BUG_KINDS) kind?: BugKind | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(BUG_SEVERITIES) severity?: BugSeverity | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(BUG_ENVIRONMENTS) environment?: BugEnvironment | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(BUG_LIMITS.module) module?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(BUG_LIMITS.text) expected?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(BUG_LIMITS.text) actual?: string | null;
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(BUG_LIMITS.steps) @IsString({ each: true }) @MaxLength(BUG_LIMITS.stepText, { each: true }) steps?: string[] | null;
  @Field(() => BugContextInput, { nullable: true }) @IsOptional() @ValidateNested() @Type(() => BugContextInput) context?: BugContextInput | null;
  @Field(() => String, { nullable: true, description: 'Captured console, network and actions as JSON ({console, network, actions}); redacted again on the server' })
  @IsOptional()
  @IsString()
  @MaxLength(BUG_LIMITS.captureJson)
  captureJson?: string | null;
}

@InputType()
export class BugStepInput {
  @Field() @IsString() @MaxLength(BUG_LIMITS.stepText) text: string;
  @Field(() => String) @IsIn(['manual', 'captured']) source: 'manual' | 'captured';
}

@InputType()
export class UpdateBugInput {
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(BUG_KINDS) kind?: BugKind | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(BUG_SEVERITIES) severity?: BugSeverity | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(BUG_ENVIRONMENTS) environment?: BugEnvironment | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(BUG_LIMITS.module) module?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(BUG_LIMITS.text) expected?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(BUG_LIMITS.text) actual?: string | null;
  @Field(() => [BugStepInput], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(BUG_LIMITS.steps) @ValidateNested({ each: true }) @Type(() => BugStepInput) steps?: BugStepInput[] | null;
}

@InputType()
export class BugFilterInput implements BugFilter {
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() @IsIn(BUG_KINDS, { each: true }) kinds?: BugKind[] | null;
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() @IsIn(BUG_SEVERITIES, { each: true }) severities?: BugSeverity[] | null;
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() @IsIn(BUG_ENVIRONMENTS, { each: true }) environments?: BugEnvironment[] | null;
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() @IsIn(BUG_QA_STATES, { each: true }) qaStates?: BugQaState[] | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(100) search?: string | null;
}
