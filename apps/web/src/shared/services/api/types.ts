export type Paginated<T> = { data: T[]; total: number; page: number; totalPages: number };
export type ItemsPage<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; pages: number; hasMore?: boolean };
};
