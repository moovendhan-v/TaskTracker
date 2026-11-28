import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  BUG_ENVIRONMENTS,
  QA_CASE_PRIORITIES,
  QA_CASE_STATUSES,
  QA_CASE_TYPES,
  QA_LIMITS,
  QA_RESULTS,
  type BugEnvironment,
  type QaCasePriority,
  type QaCaseResponse,
  type QaCaseStatus,
  type QaCaseType,
  type QaCoverageResponse,
  type QaPlanCaseResponse,
  type QaPlanCounts,
  type QaPlanResponse,
  type QaPlanStatus,
  type QaReadinessResponse,
  type QaResult,
  type QaRunResponse,
  type QaSuiteResponse,
  type ReadinessCheck,
  type RecordQaRunRequest,
  type SaveQaCaseRequest,
  type SaveQaPlanRequest,
} from '@taskflow/shared-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

@ObjectType('QaStep')
export class QaStepGql {
  @Field() action: string;
  @Field() expected: string;
}

@ObjectType('QaStepResult')
export class QaStepResultGql {
  @Field(() => String) result: QaResult;
  @Field() actual: string;
}

@ObjectType('QaSuite')
export class QaSuiteGql implements QaSuiteResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field() description: string;
  @Field(() => Int) caseCount: number;
}

@ObjectType('QaCase', { description: 'A test case: preconditions and steps, each with its expected result' })
export class QaCaseGql implements QaCaseResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field(() => ID, { nullable: true }) suiteId: string | null;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field() preconditions: string;
  @Field(() => [QaStepGql]) steps: QaStepGql[];
  @Field(() => String) priority: QaCasePriority;
  @Field(() => String) type: QaCaseType;
  @Field(() => String) status: QaCaseStatus;
  @Field(() => ID, { nullable: true }) coversTaskId: string | null;
  @Field(() => String, { nullable: true }) coversTaskTitle: string | null;
  @Field(() => String, { nullable: true }) lastResult: QaResult | null;
  @Field(() => String, { nullable: true }) lastRunAt: string | null;
  @Field() updatedAt: string;
}

@ObjectType('QaPlanCounts')
export class QaPlanCountsGql implements QaPlanCounts {
  @Field(() => Int) total: number;
  @Field(() => Int) passed: number;
  @Field(() => Int) failed: number;
  @Field(() => Int) blocked: number;
  @Field(() => Int) skipped: number;
  @Field(() => Int) notRun: number;
}

@ObjectType('QaPlan', { description: 'What to test for a sprint or a release' })
export class QaPlanGql implements QaPlanResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field() description: string;
  @Field(() => ID, { nullable: true }) sprintId: string | null;
  @Field(() => String, { nullable: true }) release: string | null;
  @Field(() => String, { description: 'open, approved or rejected' }) status: QaPlanStatus;
  @Field(() => String, { nullable: true }) decidedByName: string | null;
  @Field(() => String, { nullable: true }) decidedAt: string | null;
  @Field(() => String, { nullable: true }) decisionNote: string | null;
  @Field(() => QaPlanCountsGql) counts: QaPlanCountsGql;
  @Field() createdAt: string;
}

@ObjectType('QaPlanCase')
export class QaPlanCaseGql implements QaPlanCaseResponse {
  @Field(() => ID) caseId: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field(() => String) priority: QaCasePriority;
  @Field(() => String) type: QaCaseType;
  @Field(() => String, { nullable: true }) suiteName: string | null;
  @Field(() => ID, { nullable: true }) assigneeId: string | null;
  @Field(() => String, { nullable: true }) result: QaResult | null;
  @Field(() => ID, { nullable: true }) runId: string | null;
  @Field(() => String, { nullable: true }) executedAt: string | null;
  @Field(() => String, { nullable: true }) executedByName: string | null;
  @Field(() => ID, { nullable: true }) bugTaskId: string | null;
  @Field(() => Int, { nullable: true }) bugNumber: number | null;
  @Field(() => String, { nullable: true }) bugQaState: string | null;
  @Field(() => Int) runs: number;
}

@ObjectType('QaRun')
export class QaRunGql implements QaRunResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) planId: string;
  @Field() planName: string;
  @Field(() => ID) caseId: string;
  @Field(() => String) result: QaResult;
  @Field(() => [QaStepResultGql]) stepResults: QaStepResultGql[];
  @Field() actual: string;
  @Field(() => String, { nullable: true }) environment: BugEnvironment | null;
  @Field(() => String, { nullable: true }) build: string | null;
  @Field(() => ID, { nullable: true }) bugTaskId: string | null;
  @Field(() => Int, { nullable: true }) bugNumber: number | null;
  @Field(() => ID, { nullable: true }) retestOf: string | null;
  @Field(() => String, { nullable: true }) executedByName: string | null;
  @Field() executedAt: string;
}

@ObjectType('QaReadinessCheck')
export class QaReadinessCheckGql implements ReadinessCheck {
  @Field(() => String) key: ReadinessCheck['key'];
  @Field() ok: boolean;
  @Field() detail: string;
}

@ObjectType('QaOpenBug')
export class QaOpenBugGql {
  @Field(() => ID) taskId: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field() severity: string;
  @Field() qaState: string;
}

@ObjectType('QaReadiness')
export class QaReadinessGql implements QaReadinessResponse {
  @Field(() => QaPlanGql) plan: QaPlanGql;
  @Field(() => [QaReadinessCheckGql]) checks: QaReadinessCheckGql[];
  @Field() ready: boolean;
  @Field(() => [QaOpenBugGql]) openBugs: QaOpenBugGql[];
}

@ObjectType('QaTaskRef')
export class QaTaskRefGql {
  @Field(() => ID) taskId: string;
  @Field(() => Int) number: number;
  @Field() title: string;
}

@ObjectType('QaCaseRef')
export class QaCaseRefGql {
  @Field(() => ID) caseId: string;
  @Field(() => Int) number: number;
  @Field() title: string;
}

@ObjectType('QaCoverage')
export class QaCoverageGql implements QaCoverageResponse {
  @Field(() => Int) features: number;
  @Field(() => Int) coveredFeatures: number;
  @Field(() => [QaTaskRefGql]) uncovered: QaTaskRefGql[];
  @Field(() => Int) cases: number;
  @Field(() => Int) readyCases: number;
  @Field(() => Int) neverRun: number;
  @Field(() => [QaCaseRefGql]) flaky: QaCaseRefGql[];
}

@InputType()
export class QaStepInput {
  @Field() @IsString() @MaxLength(QA_LIMITS.stepText) action: string;
  @Field() @IsString() @MaxLength(QA_LIMITS.stepText) expected: string;
}

@InputType()
export class QaStepResultInput {
  @Field(() => String) @IsIn(QA_RESULTS) result: QaResult;
  @Field() @IsString() @MaxLength(QA_LIMITS.stepText) actual: string;
}

@InputType()
export class SaveQaCaseInput implements SaveQaCaseRequest {
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') suiteId?: string | null;
  @Field() @IsString() @MaxLength(QA_LIMITS.title) title: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(QA_LIMITS.text) preconditions?: string | null;
  @Field(() => [QaStepInput]) @IsArray() @ArrayMaxSize(QA_LIMITS.steps) @ValidateNested({ each: true }) @Type(() => QaStepInput) steps: QaStepInput[];
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(QA_CASE_PRIORITIES) priority?: QaCasePriority | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(QA_CASE_TYPES) type?: QaCaseType | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(QA_CASE_STATUSES) status?: QaCaseStatus | null;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') coversTaskId?: string | null;
}

@InputType()
export class SaveQaPlanInput implements SaveQaPlanRequest {
  @Field() @IsString() @MaxLength(QA_LIMITS.name) name: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(QA_LIMITS.description) description?: string | null;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') sprintId?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(QA_LIMITS.release) release?: string | null;
}

@InputType()
export class AddQaPlanCasesInput {
  @Field(() => [ID], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('4', { each: true }) caseIds?: string[] | null;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') suiteId?: string | null;
  @Field(() => Boolean, { nullable: true }) @IsOptional() @IsBoolean() allReady?: boolean | null;
}

@InputType()
export class RecordQaRunInput implements RecordQaRunRequest {
  @Field(() => ID) @IsUUID('4') planId: string;
  @Field(() => ID) @IsUUID('4') caseId: string;
  @Field(() => String) @IsIn(QA_RESULTS) result: QaResult;
  @Field(() => [QaStepResultInput], { nullable: true }) @IsOptional() @IsArray() @ArrayMaxSize(QA_LIMITS.steps) @ValidateNested({ each: true }) @Type(() => QaStepResultInput) stepResults?: QaStepResultInput[] | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(QA_LIMITS.text) actual?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsIn(BUG_ENVIRONMENTS) environment?: BugEnvironment | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(QA_LIMITS.build) build?: string | null;
  @Field(() => Boolean, { nullable: true, description: 'File a bug when it fails (default true)' }) @IsOptional() @IsBoolean() fileBug?: boolean | null;
}
