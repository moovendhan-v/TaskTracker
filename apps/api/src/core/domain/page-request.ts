import { PAGE_SIZE_DEFAULT, type PageQuery } from '@taskflow/shared-types';

/** A resolved page request: page and page size are always set (the size is capped where it's validated). */
export interface PageRequest {
  page: number;
  pageSize: number;
}

export function toPageRequest(query: PageQuery): PageRequest {
  return { page: query.page ?? 1, pageSize: query.pageSize ?? PAGE_SIZE_DEFAULT };
}
