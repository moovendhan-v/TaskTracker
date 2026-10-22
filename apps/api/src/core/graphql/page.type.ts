import type { Type } from '@nestjs/common';
import { ArgsType, Field, ID, Int, ObjectType, type ComplexityEstimatorArgs } from '@nestjs/graphql';
import { Type as TransformType } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@taskflow/shared-types';

/** Base for paged results: `@ObjectType() class TaskPageGql extends PageOf(TaskGql) {}`. */
export function PageOf<T>(item: Type<T>) {
  @ObjectType({ isAbstract: true })
  abstract class Page {
    @Field(() => [item]) items: T[];
    @Field(() => Int) page: number;
    @Field(() => Int) pageSize: number;
    @Field(() => Int) total: number;
  }
  return Page;
}

/** Paging arguments for list queries, with the same limits as the REST API. */
@ArgsType()
export class PageArgs {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @TransformType(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @Field(() => Int, { nullable: true, description: `1 to ${PAGE_SIZE_MAX}` })
  @IsOptional()
  @TransformType(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  pageSize?: number;
}

/**
 * Paging for workspace-scoped lists. A resolver that takes an @Args() class
 * receives every argument, so the class declares workspaceId too; the
 * WorkspaceAccessGuard checks it before the resolver runs.
 */
@ArgsType()
export class WorkspacePageArgs extends PageArgs {
  @Field(() => ID)
  @IsUUID('4')
  workspaceId: string;
}

/** Cost of a paged query: what each item costs, times the number of items asked for. */
export function pagedComplexity({ args, childComplexity }: ComplexityEstimatorArgs): number {
  const pageSize = Math.min(Number(args['pageSize'] ?? PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX);
  return 1 + pageSize * childComplexity;
}

/** Cost of an unpaged list that the API caps at `limit` items. */
export function cappedListComplexity(limit: number) {
  return ({ childComplexity }: ComplexityEstimatorArgs): number => 1 + limit * childComplexity;
}
