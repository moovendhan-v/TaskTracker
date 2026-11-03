import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsISO8601, IsString, IsUUID, MaxLength } from 'class-validator';
import { TASK_PRIORITIES } from '@taskflow/shared-types';
import type { DashboardRequest, DashboardResponse, ForecastKind, SpaceStatus, StatusCategory, TaskPriority } from '@taskflow/shared-types';
import { ForecastKindEnum, SpaceStatusEnum, StatusCategoryEnum, TaskPriorityEnum } from '../../../../core/graphql/enums.js';
import { IsClearable } from '../../../../core/graphql/validation.js';

type Summary = DashboardResponse['summary'];

@InputType('DashboardInput')
export class DashboardInput implements DashboardRequest {
  @Field() @IsISO8601({ strict: true }) from: string;
  @Field() @IsISO8601({ strict: true }) to: string;
  @Field({ description: 'IANA time zone, e.g. Europe/Berlin' }) @IsString() @MaxLength(64) timeZone: string;
  @Field(() => ID, { nullable: true }) @IsClearable() @IsUUID('4') spaceId?: string | null;
  @Field(() => [ID], { nullable: true }) @IsClearable() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(64, { each: true }) userIds?: string[] | null;
  @Field(() => Boolean, { nullable: true, description: 'Only your own tasks and hours (from your session); overrides userIds' }) @IsClearable() @IsBoolean() mine?: boolean | null;
  @Field(() => [TaskPriorityEnum], { nullable: true, description: 'Narrows the task lists to these priorities' })
  @IsClearable()
  @IsArray()
  @ArrayMaxSize(TASK_PRIORITIES.length)
  @IsIn(TASK_PRIORITIES, { each: true })
  priorities?: TaskPriority[] | null;
}

@ObjectType('DashboardStatusRef')
export class DashboardStatusRefGql {
  @Field() name: string;
  @Field() color: string;
  @Field(() => StatusCategoryEnum) category: StatusCategory;
}

@ObjectType('DashboardTask')
export class DashboardTaskGql {
  @Field(() => ID) id: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field(() => ID) spaceId: string;
  @Field() spaceName: string;
  @Field(() => String, { nullable: true }) assigneeName: string | null;
  @Field(() => TaskPriorityEnum) priority: TaskPriority;
  @Field(() => DashboardStatusRefGql) status: DashboardStatusRefGql;
  @Field(() => String, { nullable: true }) dueDate: string | null;
  @Field() updatedAt: string;
}

@ObjectType('DashboardSummary')
export class DashboardSummaryGql implements Summary {
  @Field(() => Int) projects: number;
  @Field(() => Int) openTasks: number;
  @Field(() => Int) closedTasks: number;
  @Field(() => Int) overdue: number;
  @Field(() => Int) dueSoon: number;
  @Field(() => Int) unassigned: number;
  @Field(() => Int) minutesLogged: number;
  @Field(() => Int) entries: number;
  @Field(() => Int) minutesAllTime: number;
}

@ObjectType('DashboardStatusCount')
export class DashboardStatusCountGql extends DashboardStatusRefGql {
  @Field(() => Int) count: number;
}

@ObjectType('DashboardPriorityCount')
export class DashboardPriorityCountGql {
  @Field(() => TaskPriorityEnum) priority: TaskPriority;
  @Field(() => Int) open: number;
  @Field(() => Int) overdue: number;
}

@ObjectType('DashboardForecastBucket')
export class DashboardForecastBucketGql {
  @Field() label: string;
  @Field(() => String, { nullable: true }) weekStart: string | null;
  @Field(() => Int) count: number;
  @Field(() => ForecastKindEnum) kind: ForecastKind;
}

@ObjectType('DashboardWeekFlow')
export class DashboardWeekFlowGql {
  @Field() weekStart: string;
  @Field(() => Int) created: number;
  @Field(() => Int) closed: number;
}

@ObjectType('DashboardDayMinutes')
export class DashboardDayMinutesGql {
  @Field() day: string;
  @Field(() => Int) minutes: number;
}

@ObjectType('DashboardPersonMinutes')
export class DashboardPersonMinutesGql {
  @Field(() => ID) userId: string;
  @Field() name: string;
  @Field(() => Int) minutes: number;
}

@ObjectType('DashboardProjectMinutes')
export class DashboardProjectMinutesGql {
  @Field(() => ID, { nullable: true }) spaceId: string | null;
  @Field() name: string;
  @Field(() => Int) minutes: number;
}

@ObjectType('DashboardTaskMinutes')
export class DashboardTaskMinutesGql {
  @Field(() => ID) taskId: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field(() => Int) minutes: number;
}

@ObjectType('DashboardPerson')
export class DashboardPersonGql {
  @Field(() => ID, { nullable: true, description: 'Null for the unassigned row' }) userId: string | null;
  @Field() name: string;
  @Field(() => Int) open: number;
  @Field(() => Int) overdue: number;
  @Field(() => Int) minutes: number;
}

@ObjectType('DashboardProject')
export class DashboardProjectGql {
  @Field(() => ID) spaceId: string;
  @Field() name: string;
  @Field(() => SpaceStatusEnum) status: SpaceStatus;
  @Field(() => Int) open: number;
  @Field(() => Int) closed: number;
  @Field(() => Int) overdue: number;
  @Field(() => Int) dueSoon: number;
  @Field(() => Int, { description: 'Closed share of all tasks, 0–100' }) progress: number;
  @Field(() => Int) minutes: number;
  @Field(() => Int) assignees: number;
  @Field(() => String, { nullable: true }) updatedAt: string | null;
}

@ObjectType('DashboardPhase')
export class DashboardPhaseGql {
  @Field(() => ID) id: string;
  @Field(() => Int) number: number;
  @Field() title: string;
  @Field(() => String, { nullable: true }) assigneeName: string | null;
  @Field(() => String, { nullable: true }) dueDate: string | null;
  @Field(() => Int) done: number;
  @Field(() => Int) total: number;
  @Field(() => Int) minutes: number;
  @Field(() => DashboardStatusRefGql) status: DashboardStatusRefGql;
}

@ObjectType('Dashboard')
export class DashboardGql implements DashboardResponse {
  @Field() hoursOnlyMine: boolean;
  @Field(() => DashboardSummaryGql) summary: DashboardSummaryGql;
  @Field(() => [DashboardStatusCountGql]) byStatus: DashboardStatusCountGql[];
  @Field(() => [DashboardPriorityCountGql]) byPriority: DashboardPriorityCountGql[];
  @Field(() => [Int], { description: 'Days late: 1–7, 8–30, 31–90, 90+' }) overdueAging: number[];
  @Field(() => [DashboardForecastBucketGql]) dueForecast: DashboardForecastBucketGql[];
  @Field(() => [DashboardWeekFlowGql]) createdVsClosed: DashboardWeekFlowGql[];
  @Field(() => [DashboardDayMinutesGql]) minutesPerDay: DashboardDayMinutesGql[];
  @Field(() => [DashboardPersonMinutesGql]) minutesByPerson: DashboardPersonMinutesGql[];
  @Field(() => [DashboardProjectMinutesGql]) minutesByProject: DashboardProjectMinutesGql[];
  @Field(() => [DashboardTaskMinutesGql]) minutesByTask: DashboardTaskMinutesGql[];
  @Field(() => [DashboardPersonGql]) people: DashboardPersonGql[];
  @Field(() => [DashboardProjectGql]) projects: DashboardProjectGql[];
  @Field(() => [DashboardPhaseGql]) phases: DashboardPhaseGql[];
  @Field(() => [DashboardTaskGql]) overdueTasks: DashboardTaskGql[];
  @Field(() => [DashboardTaskGql]) dueSoonTasks: DashboardTaskGql[];
  @Field(() => [DashboardTaskGql]) recentlyUpdated: DashboardTaskGql[];
}
