import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, type PageQuery } from '@taskflow/shared-types';

/** Shared paging params. Extend it for list endpoints; page size is capped server-side. */
export class PageQueryDto implements PageQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: PAGE_SIZE_MAX, default: PAGE_SIZE_DEFAULT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  pageSize?: number;
}

export interface PageRequest {
  page: number;
  pageSize: number;
}

export function toPageRequest(query: PageQuery): PageRequest {
  return { page: query.page ?? 1, pageSize: query.pageSize ?? PAGE_SIZE_DEFAULT };
}
