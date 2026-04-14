export interface AdminDashboardPageResult<T> {
  items: T[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}