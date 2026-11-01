/** Shared page/limit parsing for list endpoints — clamps to sane bounds so a client can't ask
 * for an unbounded `limit` and force a full-table scan. */
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function parsePagination(
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginatedResult<T>(items: T[], total: number, { page, limit }: PaginationParams): PaginatedResult<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
