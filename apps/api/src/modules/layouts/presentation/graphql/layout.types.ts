import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { GRID_COLUMNS, LAYOUT_LIMITS, LAYOUT_PAGES, type DashboardLayout, type LayoutItem, type LayoutPage } from '@taskflow/shared-types';
import { IsClearable } from '../../../../core/graphql/validation.js';

@ObjectType('LayoutItem')
export class LayoutItemGql implements LayoutItem {
  @Field() id: string;
  @Field() type: string;
  @Field(() => Int) x: number;
  @Field(() => Int) y: number;
  @Field(() => Int) w: number;
  @Field(() => Int) h: number;
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
  @Field(() => Int) @IsInt() @Min(LAYOUT_LIMITS.minH) @Max(LAYOUT_LIMITS.maxH) h: number;
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
