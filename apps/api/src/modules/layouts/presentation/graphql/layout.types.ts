import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { StatusCategoryEnum, TaskPriorityEnum } from '../../../../core/graphql/enums.js';
import {
  DASHBOARD_LIMITS,
  type DashboardPeriod,
  type DashboardTeam,
  DASHBOARD_VISIBILITIES,
  GRID_COLUMNS,
  LAYOUT_LIMITS,
  LAYOUT_PAGES,
  type DashboardLayout,
  type NamedDashboardResponse,
  type DashboardVisibility,
  type LayoutItem,
  type LayoutVersion,
  type WorkspaceLayout,
  type BlockAccent,
  type BlockConfig,
  BLOCK_ACCENTS,
  BLOCK_LIMITS,
  BLOCK_TITLE_MAX,
  TASK_LIST_FIELDS,
  OPEN_STATUS_CATEGORIES,
  BLOCK_ASSIGNEES_MAX,
  BLOCK_CHARTS,
  type BlockChart,
  type StatusCategory,
  TASK_PRIORITIES,
  type TaskListField,
  type TaskPriority,
  type LayoutPage,
} from '@taskflow/shared-types';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('BlockConfig', { description: 'One block\'s settings: data (spaceId, mine, priorities) kept apart from view (title, accent, limit, includeClosed, fields)' })
export class BlockConfigGql implements BlockConfig {
  @Field({ nullable: true }) title?: string;
  @Field(() => String, { nullable: true }) accent?: BlockAccent;
  @Field(() => ID, { nullable: true, description: 'Data source: one project; read with the viewer\'s own access' }) spaceId?: string;
  @Field(() => Int, { nullable: true }) limit?: (typeof BLOCK_LIMITS)[number];
  @Field({ nullable: true }) includeClosed?: boolean;
  @Field({ nullable: true, description: 'Data: only the viewer\'s own tasks' }) mine?: boolean;
  @Field(() => [TaskPriorityEnum], { nullable: true, description: 'Data: only these priorities' }) priorities?: TaskPriority[];
  @Field(() => [String], { nullable: true, description: 'View: task-list columns, in order' }) fields?: TaskListField[];
  @Field(() => [StatusCategoryEnum], { nullable: true, description: 'Data: only these status meanings' }) categories?: StatusCategory[];
  @Field(() => String, { nullable: true, description: 'View: bar or line' }) chart?: BlockChart;
  @Field(() => [ID], { nullable: true, description: 'Data: only tasks assigned to these people' }) assigneeIds?: string[];
  @Field({ nullable: true, description: 'Data: narrow to the person or project selected on the page' }) followContext?: boolean;
}

@InputType('BlockConfigInput')
export class BlockConfigInput implements BlockConfig {
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(BLOCK_TITLE_MAX) title?: string;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(BLOCK_ACCENTS) accent?: BlockAccent;
  @Field(() => ID, { nullable: true }) @IsOmittable() @IsUUID() spaceId?: string;
  @Field(() => Int, { nullable: true }) @IsOmittable() @IsIn(BLOCK_LIMITS) limit?: (typeof BLOCK_LIMITS)[number];
  @Field({ nullable: true }) @IsOmittable() @IsBoolean() includeClosed?: boolean;
  @Field({ nullable: true }) @IsOmittable() @IsBoolean() mine?: boolean;
  @Field(() => [TaskPriorityEnum], { nullable: true }) @IsOmittable() @IsArray() @ArrayMaxSize(TASK_PRIORITIES.length) @ArrayUnique() @IsIn(TASK_PRIORITIES, { each: true }) priorities?: TaskPriority[];
  @Field(() => [String], { nullable: true }) @IsOmittable() @IsArray() @ArrayMaxSize(TASK_LIST_FIELDS.length) @ArrayUnique() @IsIn(TASK_LIST_FIELDS, { each: true }) fields?: TaskListField[];
  @Field(() => [StatusCategoryEnum], { nullable: true }) @IsOmittable() @IsArray() @ArrayMaxSize(OPEN_STATUS_CATEGORIES.length) @ArrayUnique() @IsIn(OPEN_STATUS_CATEGORIES, { each: true }) categories?: StatusCategory[];
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(BLOCK_CHARTS) chart?: BlockChart;
  @Field(() => [ID], { nullable: true }) @IsOmittable() @IsArray() @ArrayMaxSize(BLOCK_ASSIGNEES_MAX) @ArrayUnique() @IsString({ each: true }) @Matches(/^[A-Za-z0-9_-]{1,64}$/, { each: true }) assigneeIds?: string[];
  @Field({ nullable: true }) @IsOmittable() @IsBoolean() followContext?: boolean;
}

@ObjectType('LayoutItem')
export class LayoutItemGql implements LayoutItem {
  @Field() id: string;
  @Field() type: string;
  @Field(() => Int) x: number;
  @Field(() => Int) y: number;
  @Field(() => Int) w: number;
  @Field(() => Int) h: number;
  @Field(() => BlockConfigGql, { nullable: true }) config?: BlockConfigGql | null;
  @Field(() => [String], { nullable: true, description: 'Other blocks stacked in this slot, as tabs' }) tabs?: string[] | null;
  @Field(() => Boolean, { nullable: true, description: 'Pinned by the workspace default: it stays where it is for everyone' }) pinned?: boolean | null;
}

@ObjectType('DashboardLayout', { description: "The signed-in user's arrangement of a page's blocks" })
export class DashboardLayoutGql implements DashboardLayout {
  @Field(() => String) pageKey: LayoutPage;
  @Field(() => Int, { description: 'Goes up by one on every save; send it back as baseVersion' }) version: number;
  @Field(() => [LayoutItemGql]) items: LayoutItemGql[];
  @Field() updatedAt: string;
}

@InputType('LayoutItemInput')
export class LayoutItemInput implements LayoutItem {
  @Field() @IsString() @MaxLength(LAYOUT_LIMITS.idMax) @Matches(/^[a-z0-9][a-z0-9-]*$/) id: string;
  @Field() @IsString() @MaxLength(60) type: string;
  @Field(() => Int) @IsInt() @Min(0) @Max(GRID_COLUMNS - 1) x: number;
  @Field(() => Int) @IsInt() @Min(0) @Max(LAYOUT_LIMITS.maxRow) y: number;
  @Field(() => Int) @IsInt() @Min(LAYOUT_LIMITS.minW) @Max(GRID_COLUMNS) w: number;
  @Field(() => Int, { description: 'Rows; sections may be 1, other blocks at least 2 (checked by the layout rules)' }) @IsInt() @Min(1) @Max(LAYOUT_LIMITS.maxH) h: number;
  @Field(() => BlockConfigInput, { nullable: true }) @IsClearable() @ValidateNested() @Type(() => BlockConfigInput) config?: BlockConfigInput | null;
  @Field(() => [String], { nullable: true }) @IsClearable() @IsArray() @ArrayMaxSize(LAYOUT_LIMITS.tabsMax) @IsString({ each: true }) @MaxLength(60, { each: true }) tabs?: string[] | null;
  @Field(() => Boolean, { nullable: true, description: 'In a workspace default: pinned for everyone. Only layout managers set it; it is ignored in other people\'s saves' }) @IsClearable() @IsBoolean() pinned?: boolean | null;
}

@InputType('SaveLayoutInput')
export class SaveLayoutInput {
  @Field(() => String) @IsIn(LAYOUT_PAGES) pageKey: LayoutPage;

  @Field(() => Int, { nullable: true, description: 'The version you started from; null when you had none saved' })
  @IsClearable()
  @IsInt()
  @Min(1)
  baseVersion: number | null;

  @Field(() => [LayoutItemInput])
  @IsArray()
  @ArrayMaxSize(LAYOUT_LIMITS.items)
  @ValidateNested({ each: true })
  @Type(() => LayoutItemInput)
  items: LayoutItemInput[];
}

@ObjectType('NamedDashboard', { description: 'A Home dashboard tab: private to its owner, shared with one department (a team) or with the workspace' })
export class NamedDashboardGql implements NamedDashboardResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String) visibility: DashboardVisibility;
  @Field(() => ID) ownerId: string;
  @Field({ description: 'You own it, so you can edit, share or delete it' }) mine: boolean;
  @Field(() => Int) version: number;
  @Field(() => [LayoutItemGql]) items: LayoutItemGql[];
  @Field(() => String, { nullable: true, description: 'The date range it opens with (this_week, last_30, …); null for the page’s own' }) period: DashboardPeriod | null;
  @Field(() => ID, { nullable: true, description: 'The team it is shared with (visibility "department"); null if that department was deleted' }) departmentId: string | null;
  @Field(() => String, { nullable: true }) departmentName: string | null;
  @Field() updatedAt: string;
}

@ObjectType('DashboardTeam', { description: 'A department you belong to or lead: a team you can share a dashboard with' })
export class DashboardTeamGql implements DashboardTeam {
  @Field(() => ID) id: string;
  @Field() name: string;
}

@InputType('CreateDashboardInput')
export class CreateDashboardInput {
  @Field() @IsString() @IsNotBlank() @MaxLength(DASHBOARD_LIMITS.nameMax) name: string;
  @Field(() => String, { defaultValue: 'private' }) @IsIn(DASHBOARD_VISIBILITIES) visibility: DashboardVisibility = 'private';

  @Field(() => [LayoutItemInput], { nullable: true, description: 'Start from these blocks; the default Home layout when omitted' })
  @IsClearable()
  @IsArray()
  @ArrayMaxSize(LAYOUT_LIMITS.items)
  @ValidateNested({ each: true })
  @Type(() => LayoutItemInput)
  items?: LayoutItemInput[] | null;
}

@InputType('UpdateDashboardInput')
export class UpdateDashboardInput {
  @Field({ nullable: true }) @IsOmittable() @IsString() @IsNotBlank() @MaxLength(DASHBOARD_LIMITS.nameMax) name?: string;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(DASHBOARD_VISIBILITIES) visibility?: DashboardVisibility;
  @Field(() => ID, { nullable: true, description: 'With visibility "department": the team to share with; it must be one of yours' }) @IsOmittable() @IsUUID() departmentId?: string;
  @Field(() => String, { nullable: true, description: 'The date range it opens with: a preset (this_week, last_30, …) or custom:YYYY-MM-DD..YYYY-MM-DD' }) @IsOmittable() @IsString() @MaxLength(40) period?: DashboardPeriod;
}

@InputType('SaveDashboardLayoutInput')
export class SaveDashboardLayoutInput {
  @Field(() => Int) @IsInt() @Min(1) baseVersion: number;

  @Field(() => [LayoutItemInput])
  @IsArray()
  @ArrayMaxSize(LAYOUT_LIMITS.items)
  @ValidateNested({ each: true })
  @Type(() => LayoutItemInput)
  items: LayoutItemInput[];
}

@ObjectType('WorkspaceLayout', { description: 'The arrangement everyone in the workspace starts on for a page' })
export class WorkspaceLayoutGql implements WorkspaceLayout {
  @Field(() => String) pageKey: LayoutPage;
  @Field(() => [LayoutItemGql]) items: LayoutItemGql[];
  @Field() updatedAt: string;
  @Field(() => String, { nullable: true }) updatedByName: string | null;
  @Field({ description: 'Everyone sees this layout; only layout managers arrange the page' }) locked: boolean;
}

@ObjectType('LayoutVersion', { description: 'One of your recent saves of a page' })
export class LayoutVersionGql implements LayoutVersion {
  @Field(() => Int) version: number;
  @Field() savedAt: string;
  @Field(() => [LayoutItemGql]) items: LayoutItemGql[];
}

@InputType('SetWorkspaceLayoutInput')
export class SetWorkspaceLayoutInput {
  @Field(() => String) @IsIn(LAYOUT_PAGES) pageKey: LayoutPage;

  @Field(() => [LayoutItemInput])
  @IsArray()
  @ArrayMaxSize(LAYOUT_LIMITS.items)
  @ValidateNested({ each: true })
  @Type(() => LayoutItemInput)
  items: LayoutItemInput[];
}
