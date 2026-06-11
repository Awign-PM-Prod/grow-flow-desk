import { useCallback, useEffect, useState } from "react";
import { loadPersistedFilters, savePersistedFilters } from "@/lib/pageSession";

export function usePersistedFilters<T extends Record<string, unknown>>(
  pageKey: string,
  defaultFilters: T,
): [T, (patch: Partial<T> | ((prev: T) => T)) => void] {
  const [filters, setFiltersState] = useState<T>(() => {
    const stored = loadPersistedFilters<T>(pageKey);
    return stored ? { ...defaultFilters, ...stored } : defaultFilters;
  });

  const setFilters = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      setFiltersState((prev) => {
        const next =
          typeof patch === "function"
            ? (patch as (p: T) => T)(prev)
            : { ...prev, ...patch };
        savePersistedFilters(pageKey, next);
        return next;
      });
    },
    [pageKey],
  );

  useEffect(() => {
    savePersistedFilters(pageKey, filters);
  }, [pageKey, filters]);

  return [filters, setFilters];
}
