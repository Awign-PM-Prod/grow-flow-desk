import { useEffect, useMemo, useState } from "react";

export const TABLE_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

const DEFAULT_THRESHOLD = 25;

export function useTablePagination<T>(
  items: T[],
  options?: { threshold?: number; defaultPageSize?: TablePageSize },
) {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const [pageSize, setPageSize] = useState<TablePageSize>(options?.defaultPageSize ?? 25);
  const [page, setPage] = useState(1);

  const enabled = items.length > threshold;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [pageSize, totalItems]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    if (!enabled) return items;
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, enabled, currentPage, pageSize]);

  const startIndex = enabled ? (currentPage - 1) * pageSize : 0;

  return {
    enabled,
    paginatedItems,
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    startIndex,
  };
}
