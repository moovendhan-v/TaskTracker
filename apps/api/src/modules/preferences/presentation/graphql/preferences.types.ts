import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import {
  ACCENTS,
  COLOR_PATTERN,
  DATE_FORMATS,
  DENSITIES,
  FILTER_LIMITS,
  PREFERENCE_LIMITS,
  TASK_DETAIL_MODES,
  TASK_VIEWS,
  THEMES,
  TIME_FORMATS,
  type Accent,
  type DateFormat,
  type Density,
  type PreferenceSettings,
  type SavedView,
  type TableLayout,
  type TaskDetailMode,
  type TaskView,
  type Theme,
  type TimeFormat,
  type UserPreferences,
  type WorkspaceTab,
} from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { FilterInput, FilterNodeGql, SortInput, SortSpecGql } from '../../../../core/graphql/resource-query.types.js';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('ColumnWidth')
export class ColumnWidthGql {
  @Field() column: string;
  @Field(() => Int) width: number;
}

@ObjectType('TableLayout')
export class TableLayoutGql implements TableLayout {
  @Field() key: string;
  @Field(() => [String]) columns: string[];
  @Field(() => [String]) hidden: string[];
  @Field(() => [ColumnWidthGql]) widths: ColumnWidthGql[];
  @Field(() => Int, { nullable: true }) pageSize?: number | null;
  @Field(() => [SortSpecGql], { nullable: true }) sort?: SortSpecGql[] | null;
}

@ObjectType('SavedView')
export class SavedViewGql implements SavedView {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() resource: string;
  @Field(() => String, { nullable: true }) scope?: string | null;
  @Field(() => String, { nullable: true }) where?: string | null;
  @Field(() => FilterNodeGql, { nullable: true }) filter?: FilterNodeGql | null;
  @Field(() => [SortSpecGql], { nullable: true }) sort?: SortSpecGql[] | null;
  @Field(() => [String], { nullable: true }) columns?: string[] | null;
  @Field() pinned: boolean;
  @Field(() => String, { nullable: true }) color?: string | null;
}

@ObjectType('WorkspaceTab')
export class WorkspaceTabGql implements WorkspaceTab {
  @Field() id: string;
  @Field() path: string;
  @Field() title: string;
  @Field() pinned: boolean;
}

@ObjectType('Preferences', { description: 'Personal settings; they follow the user to every device' })
export class PreferencesGql implements UserPreferences {
  @Field(() => String) theme: Theme;
  @Field(() => String) accent: Accent;
  @Field(() => String) density: Density;
  @Field() sidebarCollapsed: boolean;
  @Field(() => Int) sidebarWidth: number;
  @Field(() => String) defaultTaskView: TaskView;
  @Field(() => String) taskDetailMode: TaskDetailMode;
  @Field(() => String) dateFormat: DateFormat;
  @Field(() => String) timeFormat: TimeFormat;
  @Field(() => Int) weekStart: number;
  @Field(() => [TableLayoutGql]) tables: TableLayoutGql[];
  @Field(() => [SavedViewGql]) savedViews: SavedViewGql[];
  @Field(() => [WorkspaceTabGql]) tabs: WorkspaceTabGql[];
}

@FormSchema('preferences.update')
@InputType('UpdatePreferencesInput')
export class UpdatePreferencesInput implements Partial<PreferenceSettings> {
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(THEMES) theme?: Theme;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(ACCENTS) accent?: Accent;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(DENSITIES) density?: Density;
  @Field({ nullable: true }) @IsOmittable() @IsBoolean() sidebarCollapsed?: boolean;
  @Field(() => Int, { nullable: true })
  @IsOmittable()
  @IsInt()
  @Min(PREFERENCE_LIMITS.sidebarWidthMin)
  @Max(PREFERENCE_LIMITS.sidebarWidthMax)
  sidebarWidth?: number;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(TASK_VIEWS) defaultTaskView?: TaskView;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(TASK_DETAIL_MODES) taskDetailMode?: TaskDetailMode;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(DATE_FORMATS) dateFormat?: DateFormat;
  @Field(() => String, { nullable: true }) @IsOmittable() @IsIn(TIME_FORMATS) timeFormat?: TimeFormat;
  @Field(() => Int, { nullable: true }) @IsOmittable() @IsIn([0, 1]) weekStart?: number;
}

@InputType('ColumnWidthInput')
export class ColumnWidthInput {
  @Field() @IsString() @MaxLength(64) column: string;
  @Field(() => Int) @IsInt() @Min(PREFERENCE_LIMITS.columnWidthMin) @Max(PREFERENCE_LIMITS.columnWidthMax) width: number;
}

@InputType('TableLayoutInput')
export class TableLayoutInput implements TableLayout {
  @Field() @IsString() @IsNotBlank() @MaxLength(PREFERENCE_LIMITS.keyMax) key: string;

  @Field(() => [String])
  @IsArray()
  @ArrayMaxSize(PREFERENCE_LIMITS.columns)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  columns: string[];

  @Field(() => [String])
  @IsArray()
  @ArrayMaxSize(PREFERENCE_LIMITS.columns)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  hidden: string[];

  @Field(() => [ColumnWidthInput])
  @IsArray()
  @ArrayMaxSize(PREFERENCE_LIMITS.columns)
  @ValidateNested({ each: true })
  @Type(() => ColumnWidthInput)
  widths: ColumnWidthInput[];

  @Field(() => Int, { nullable: true }) @IsClearable() @IsInt() @Min(1) @Max(100) pageSize?: number | null;

  @Field(() => [SortInput], { nullable: true })
  @IsClearable()
  @IsArray()
  @ArrayMaxSize(FILTER_LIMITS.maxSortFields)
  @ValidateNested({ each: true })
  @Type(() => SortInput)
  sort?: SortInput[] | null;
}

@FormSchema('view.save')
@InputType('SaveViewInput')
export class SaveViewInput implements Omit<SavedView, 'id'> {
  @Field(() => ID, { nullable: true, description: 'Leave out to create a view' }) @IsClearable() @IsUUID('4') id?: string | null;
  @Field() @IsString() @IsNotBlank() @MaxLength(PREFERENCE_LIMITS.nameMax) name: string;
  @Field() @IsString() @Matches(/^[a-z][a-z_]{0,63}$/) resource: string;
  @Field(() => String, { nullable: true }) @IsClearable() @IsString() @MaxLength(PREFERENCE_LIMITS.keyMax) scope?: string | null;
  @Field(() => String, { nullable: true }) @IsClearable() @IsString() @MaxLength(4000) where?: string | null;

  @Field(() => FilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterInput)
  filter?: FilterInput | null;

  @Field(() => [SortInput], { nullable: true })
  @IsClearable()
  @IsArray()
  @ArrayMaxSize(FILTER_LIMITS.maxSortFields)
  @ValidateNested({ each: true })
  @Type(() => SortInput)
  sort?: SortInput[] | null;

  @Field(() => [String], { nullable: true })
  @IsClearable()
  @IsArray()
  @ArrayMaxSize(PREFERENCE_LIMITS.columns)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  columns?: string[] | null;

  @Field({ defaultValue: false }) @IsBoolean() pinned: boolean;
  @Field(() => String, { nullable: true }) @IsClearable() @Matches(new RegExp(COLOR_PATTERN)) color?: string | null;
}

@InputType('WorkspaceTabInput')
export class WorkspaceTabInput implements WorkspaceTab {
  @Field() @IsString() @Matches(/^[A-Za-z0-9_-]{1,64}$/) id: string;
  @Field() @IsString() @MaxLength(500) path: string;
  @Field() @IsString() @MaxLength(120) title: string;
  @Field({ defaultValue: false }) @IsBoolean() pinned: boolean;
}

/** Wraps the list so every tab is validated (list arguments of inputs aren't). */
@InputType('SetTabsInput')
export class SetTabsInput {
  @Field(() => [WorkspaceTabInput])
  @IsArray()
  @ArrayMaxSize(PREFERENCE_LIMITS.tabs)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceTabInput)
  tabs: WorkspaceTabInput[];
}
