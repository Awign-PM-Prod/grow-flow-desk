/** In-memory + sessionStorage persistence for page filters and cached fetch results. */

const filterMemory = new Map<string, unknown>();
const dataMemory = new Map<string, { hash: string; data: unknown }>();

const STORAGE_PREFIX = "gfd:page-filters:";

export function loadPersistedFilters<T>(pageKey: string): T | null {
  try {
    if (filterMemory.has(pageKey)) {
      return filterMemory.get(pageKey) as T;
    }
    const raw = sessionStorage.getItem(STORAGE_PREFIX + pageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    filterMemory.set(pageKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedFilters(pageKey: string, filters: unknown): void {
  filterMemory.set(pageKey, filters);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(filters));
  } catch {
    // ignore quota errors
  }
}

export function hashPageFilters(filters: unknown): string {
  return JSON.stringify(filters);
}

export function getPageDataCache<T>(pageKey: string, hash: string): T | null {
  const entry = dataMemory.get(pageKey);
  if (entry?.hash === hash) return entry.data as T;
  return null;
}

export function setPageDataCache(pageKey: string, hash: string, data: unknown): void {
  dataMemory.set(pageKey, { hash, data });
}

export function clearPageDataCache(pageKey: string): void {
  dataMemory.delete(pageKey);
}

/** Static hash for list pages where filters are client-side only. */
export const PAGE_LIST_DATA_HASH = "list-data";
