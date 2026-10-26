import { Field, InputType, Int, ObjectType, type ComplexityEstimatorArgs } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import {
  FILTER_LIMITS,
  FILTER_OPERATORS,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  type EnumOption,
  type FieldType,
  type FilterCondition,
  type FilterGroup,
  type FilterOperator,
  type LogicOperator,
  type ResourceFieldSchema,
  type ResourceQuery,
  type ResourceSchema,
  type SortDirection,
  type SortSpec,
} from '@taskflow/shared-types';
import { FieldTypeEnum, FilterOperatorEnum, LogicOperatorEnum, SortDirectionEnum } from './enums.js';

/**
 * One node of a filter tree: either a condition (field, op, value/values) or a
 * group (exactly one of and, or, not). The API checks it against the resource,
 * so the shape here only has to be well-formed.
 */
@InputType('FilterInput')
export class FilterInput implements FilterCondition, FilterGroup {
  @Field(() => [FilterInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FILTER_LIMITS.maxConditions)
  @ValidateNested({ each: true })
  @Type(() => FilterInput)
  and?: FilterInput[] | null;

  @Field(() => [FilterInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FILTER_LIMITS.maxConditions)
  @ValidateNested({ each: true })
  @Type(() => FilterInput)
  or?: FilterInput[] | null;

  @Field(() => FilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterInput)
  not?: FilterInput | null;

  @Field({ nullable: true, description: 'A field name; json fields take a key: metadata.order_id' })
  @IsOptional()
  @IsString()
  @MaxLength(130)
  field: string;

  @Field(() => FilterOperatorEnum, { nullable: true })
  @IsOptional()
  @IsIn(FILTER_OPERATORS)
  op: FilterOperator;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FILTER_LIMITS.maxValueLength)
  value?: string | null;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FILTER_LIMITS.maxListValues)
  @IsString({ each: true })
  @MaxLength(FILTER_LIMITS.maxValueLength, { each: true })
  values?: string[] | null;
}

@InputType('SortInput')
export class SortInput implements SortSpec {
  @Field()
  @IsString()
  @MaxLength(64)
  field: string;

  @Field(() => SortDirectionEnum, { defaultValue: 'asc' })
  @IsIn(['asc', 'desc'])
  direction: SortDirection;
}

/** Filters, sort, search and paging for any query resource. See `resourceSchema` for what each resource supports. */
@InputType('ResourceQueryInput')
export class ResourceQueryInput implements ResourceQuery {
  @Field(() => FilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterInput)
  filter?: FilterInput | null;

  @Field(() => String, { nullable: true, description: 'Filters as a query string, e.g. status[in]=todo,done&metadata[order_id]=6735' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  where?: string | null;

  @Field(() => [SortInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FILTER_LIMITS.maxSortFields)
  @ValidateNested({ each: true })
  @Type(() => SortInput)
  sort?: SortInput[] | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(FILTER_LIMITS.maxValueLength)
  search?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  pageSize?: number | null;
}

/** Cost of a resource query: what each item costs, times the page size asked for. */
export function resourceQueryComplexity({ args, childComplexity }: ComplexityEstimatorArgs): number {
  const query = args['query'] as ResourceQuery | undefined;
  const pageSize = Math.min(Number(query?.pageSize ?? PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX);
  return 1 + pageSize * childComplexity;
}

/** A filter tree as stored in saved views: the output twin of FilterInput. */
@ObjectType('FilterNode')
export class FilterNodeGql {
  @Field(() => [FilterNodeGql], { nullable: true }) and?: FilterNodeGql[] | null;
  @Field(() => [FilterNodeGql], { nullable: true }) or?: FilterNodeGql[] | null;
  @Field(() => FilterNodeGql, { nullable: true }) not?: FilterNodeGql | null;
  @Field(() => String, { nullable: true }) field?: string;
  @Field(() => FilterOperatorEnum, { nullable: true }) op?: FilterOperator;
  @Field(() => String, { nullable: true }) value?: string | null;
  @Field(() => [String], { nullable: true }) values?: string[] | null;
}

@ObjectType('EnumOption')
export class EnumOptionGql implements EnumOption {
  @Field() value: string;
  @Field() label: string;
  @Field(() => String, { nullable: true }) color?: string | null;
}

@ObjectType('ResourceFieldSchema')
export class ResourceFieldSchemaGql implements ResourceFieldSchema {
  @Field() name: string;
  @Field() label: string;
  @Field(() => FieldTypeEnum) type: FieldType;
  @Field(() => [FilterOperatorEnum]) operators: FilterOperator[];
  @Field() sortable: boolean;
  @Field() defaultVisible: boolean;
  @Field(() => [EnumOptionGql], { nullable: true }) options?: EnumOptionGql[] | null;
  @Field() keyed: boolean;
  @Field(() => String, { nullable: true }) display?: string | null;
  @Field(() => Int, { nullable: true }) width?: number | null;
}

@ObjectType('SortSpec')
export class SortSpecGql implements SortSpec {
  @Field() field: string;
  @Field(() => SortDirectionEnum) direction: SortDirection;
}

@ObjectType('QueryLimits')
export class QueryLimitsGql {
  @Field(() => Int) maxDepth: number;
  @Field(() => Int) maxConditions: number;
  @Field(() => Int) maxListValues: number;
  @Field(() => Int) maxSortFields: number;
}

@ObjectType('ResourceSchema', { description: 'How a resource can be listed: fields, operators, sorting and paging. Clients build tables from it.' })
export class ResourceSchemaGql implements ResourceSchema {
  @Field() resource: string;
  @Field() label: string;
  @Field(() => [ResourceFieldSchemaGql]) fields: ResourceFieldSchemaGql[];
  @Field(() => [LogicOperatorEnum]) logic: LogicOperator[];
  @Field() searchable: boolean;
  @Field(() => [SortSpecGql]) defaultSort: SortSpecGql[];
  @Field(() => Int) defaultPageSize: number;
  @Field(() => Int) maxPageSize: number;
  @Field(() => QueryLimitsGql) limits: QueryLimitsGql;
}
