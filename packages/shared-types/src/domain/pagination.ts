export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 100;

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
