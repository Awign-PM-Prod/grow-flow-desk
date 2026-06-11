import {
  clearPageDataCache,
  getPageDataCache,
  PAGE_LIST_DATA_HASH,
  setPageDataCache,
} from "@/lib/pageSession";

export function restoreListData<T>(pageKey: string): T | null {
  return getPageDataCache<T>(pageKey, PAGE_LIST_DATA_HASH);
}

export function storeListData<T>(pageKey: string, data: T): void {
  setPageDataCache(pageKey, PAGE_LIST_DATA_HASH, data);
}

export function invalidateListData(pageKey: string): void {
  clearPageDataCache(pageKey);
}

export type SerializableDateRange = { from?: string; to?: string };

export function serializeDateRange(
  range: { from?: Date; to?: Date } | undefined,
): SerializableDateRange | undefined {
  if (!range) return undefined;
  return {
    from: range.from?.toISOString(),
    to: range.to?.toISOString(),
  };
}

export function deserializeDateRange(
  range: SerializableDateRange | undefined,
): { from?: Date; to?: Date } | undefined {
  if (!range) return undefined;
  return {
    from: range.from ? new Date(range.from) : undefined,
    to: range.to ? new Date(range.to) : undefined,
  };
}
