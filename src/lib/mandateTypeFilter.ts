export const MANDATE_TYPE_FILTER_OPTIONS = [
  "Existing",
  "New Cross Sell",
  "New Acquisition",
] as const;

export type MandateTypeFilterOption = (typeof MANDATE_TYPE_FILTER_OPTIONS)[number];

/** Empty selection means all mandate types (same as "All Mandate Types"). */
export function isAllMandateTypes(selected: readonly string[]): boolean {
  return selected.length === 0;
}

export function mandateTypeIsSelected(
  selected: readonly string[],
  type: string | null | undefined,
): boolean {
  if (isAllMandateTypes(selected)) return true;
  if (!type) return false;
  return selected.includes(type);
}

export function selectedIncludesExisting(selected: readonly string[]): boolean {
  return isAllMandateTypes(selected) || selected.includes("Existing");
}

export function selectedIncludesCrossSell(selected: readonly string[]): boolean {
  return isAllMandateTypes(selected) || selected.includes("New Cross Sell");
}

export function selectedIncludesNewAcquisition(selected: readonly string[]): boolean {
  return isAllMandateTypes(selected) || selected.includes("New Acquisition");
}

/**
 * Normalize persisted filter values: new `string[]`, or the old single-select strings.
 */
export function normalizeMandateTypeFilter(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return MANDATE_TYPE_FILTER_OPTIONS.filter((value) => raw.includes(value));
  }
  if (typeof raw !== "string") return [];
  switch (raw) {
    case "":
    case "all":
    case "All mandate types":
      return [];
    case "Existing":
      return ["Existing"];
    case "New Cross Sell":
    case "All Cross Sell":
      return ["New Cross Sell"];
    case "New Acquisition":
    case "New Acquisitions":
      return ["New Acquisition"];
    case "All Cross Sell + Existing":
      return ["Existing", "New Cross Sell"];
    default:
      return [];
  }
}

export function toggleMandateTypeFilter(
  selected: readonly string[],
  value: string,
): string[] {
  const next = selected.includes(value)
    ? selected.filter((item) => item !== value)
    : MANDATE_TYPE_FILTER_OPTIONS.filter(
        (item) => selected.includes(item) || item === value,
      );
  if (next.length === MANDATE_TYPE_FILTER_OPTIONS.length) return [];
  return [...next];
}

export function mandateTypeFilterLabel(selected: readonly string[]): string {
  if (isAllMandateTypes(selected)) return "All Mandate Types";
  if (selected.length === 1) return selected[0];
  return `${selected.length} types selected`;
}

/** Org-level manager_targets: existing bucket vs new-acquisition bucket. */
export function managerTargetValueForSelectedTypes(
  existing: number,
  newAc: number,
  selected: readonly string[],
): number {
  if (isAllMandateTypes(selected)) return existing + newAc;
  let sum = 0;
  if (selected.includes("Existing") || selected.includes("New Cross Sell")) {
    sum += existing;
  }
  if (selected.includes("New Acquisition")) {
    sum += newAc;
  }
  return sum;
}

export function monthlyTargetTypesForSelection(
  selected: readonly string[],
): { targetTypes: string[]; requireMandateIds: boolean } {
  const wantExistingRows =
    isAllMandateTypes(selected) ||
    selected.includes("Existing") ||
    selected.includes("New Acquisition");
  const wantCrossSellRows =
    isAllMandateTypes(selected) || selected.includes("New Cross Sell");
  const targetTypes: string[] = [];
  if (wantExistingRows) targetTypes.push("existing");
  if (wantCrossSellRows) targetTypes.push("new_cross_sell");
  return {
    targetTypes,
    requireMandateIds: wantExistingRows && !wantCrossSellRows,
  };
}
