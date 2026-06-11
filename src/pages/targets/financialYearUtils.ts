/** Internal FY key used with monthly_targets.financial_year via fyKeyToFinancialYearString (e.g. FY25 → "2025-26"). */

export function getCurrentFYKey(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fyYearDigits = fyStartYear.toString().slice(-2);
  return `FY${fyYearDigits}`;
}

/** Display label e.g. FY25 → "FY 2025-26" */
export function formatFYLabel(fyKey: string): string {
  const yearMatch = fyKey.match(/FY(\d{2})/);
  if (!yearMatch) {
    if (fyKey.match(/^\d{4}-\d{2}$/)) {
      return `FY ${fyKey}`;
    }
    return fyKey;
  }
  const yearDigits = parseInt(yearMatch[1], 10);
  const startYear = 2000 + yearDigits;
  const endShort = String(startYear + 1).slice(-2);
  return `FY ${startYear}-${endShort}`;
}

/** FY25 → "2025-26" for monthly_targets.financial_year */
export function fyKeyToFinancialYearString(fyKey: string): string {
  const yearMatch = fyKey.match(/FY(\d{2})/);
  if (!yearMatch) return "";
  const yearDigits = parseInt(yearMatch[1], 10);
  const startYear = 2000 + yearDigits;
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

/** Current FY and past `pastCount` FY keys, newest first */
export function listFYKeysDescending(pastCount: number): string[] {
  const current = getCurrentFYKey();
  const yearMatch = current.match(/FY(\d{2})/);
  if (!yearMatch) return [current];
  const currentStart = 2000 + parseInt(yearMatch[1], 10);
  const keys: string[] = [];
  for (let i = 0; i <= pastCount; i++) {
    const y = currentStart - i;
    const digits = y.toString().slice(-2);
    keys.push(`FY${digits}`);
  }
  return keys;
}

export function calculateFinancialYear(month: number, year: number): string {
  if (!month || !year) return "";
  if (month >= 1 && month <= 3) {
    const startYear = year - 1;
    const endYear = year.toString().slice(-2);
    return `${startYear}-${endYear}`;
  }
  const startYear = year;
  const endYear = (year + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

export function getFinancialYearMonths(fyString: string): Array<{
  month: number;
  year: number;
  key: string;
  label: string;
}> {
  const yearMatch = fyString.match(/FY(\d{2})/);
  if (!yearMatch) return [];

  const yearDigits = parseInt(yearMatch[1], 10);
  const fyStartYear = 2000 + yearDigits;
  const fyEndYear = fyStartYear + 1;

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthColumns: Array<{ month: number; year: number; key: string; label: string }> = [];

  for (let month = 4; month <= 12; month++) {
    monthColumns.push({
      month,
      year: fyStartYear,
      key: `${fyStartYear}-${String(month).padStart(2, "0")}`,
      label: `${monthNames[month - 1]} ${fyStartYear}`,
    });
  }
  for (let month = 1; month <= 3; month++) {
    monthColumns.push({
      month,
      year: fyEndYear,
      key: `${fyEndYear}-${String(month).padStart(2, "0")}`,
      label: `${monthNames[month - 1]} ${fyEndYear}`,
    });
  }

  return monthColumns;
}

/** Calendar months in FY for manager_targets queries */
export function getMonthYearPairsForFY(fyKey: string): Array<{ month: number; year: number }> {
  return getFinancialYearMonths(fyKey).map(({ month, year }) => ({ month, year }));
}

/** Indian FY quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar (calendar year on each pair). */
export function getFYQuarterMonthYearPairs(
  refMonth: number,
  refYear: number
): Array<{ month: number; year: number }> {
  if (refMonth >= 4 && refMonth <= 6) {
    return [
      { month: 4, year: refYear },
      { month: 5, year: refYear },
      { month: 6, year: refYear },
    ];
  }
  if (refMonth >= 7 && refMonth <= 9) {
    return [
      { month: 7, year: refYear },
      { month: 8, year: refYear },
      { month: 9, year: refYear },
    ];
  }
  if (refMonth >= 10 && refMonth <= 12) {
    return [
      { month: 10, year: refYear },
      { month: 11, year: refYear },
      { month: 12, year: refYear },
    ];
  }
  return [
    { month: 1, year: refYear },
    { month: 2, year: refYear },
    { month: 3, year: refYear },
  ];
}

/** Quarter immediately after the one containing refMonth/refYear. */
export function getNextFYQuarterMonthYearPairs(
  refMonth: number,
  refYear: number
): Array<{ month: number; year: number }> {
  if (refMonth >= 4 && refMonth <= 6) {
    return [
      { month: 7, year: refYear },
      { month: 8, year: refYear },
      { month: 9, year: refYear },
    ];
  }
  if (refMonth >= 7 && refMonth <= 9) {
    return [
      { month: 10, year: refYear },
      { month: 11, year: refYear },
      { month: 12, year: refYear },
    ];
  }
  if (refMonth >= 10 && refMonth <= 12) {
    return [
      { month: 1, year: refYear + 1 },
      { month: 2, year: refYear + 1 },
      { month: 3, year: refYear + 1 },
    ];
  }
  return [
    { month: 4, year: refYear },
    { month: 5, year: refYear },
    { month: 6, year: refYear },
  ];
}

const LONG_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonthYearLong(month: number, year: number): string {
  if (month < 1 || month > 12) return "";
  return `${LONG_MONTH_NAMES[month - 1]} ${year}`;
}

/** Sentinel for cross-sell dashboard FY filter — show lifetime data. */
export const FY_FILTER_ALL = "all";

export function getFinancialYearDateRange(fyKey: string): { start: Date; end: Date } {
  const yearMatch = fyKey.match(/FY(\d{2})/);
  if (!yearMatch) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    return {
      start: new Date(startYear, 3, 1),
      end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
    };
  }

  const startYear = 2000 + parseInt(yearMatch[1], 10);
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
}

export function getYearForMonthInFY(month: number, fyKey: string): number {
  const fyStartYear = getFinancialYearDateRange(fyKey).start.getFullYear();
  if (month >= 1 && month <= 3) return fyStartYear + 1;
  return fyStartYear;
}

export function isLifetimeFySelection(selectedFys: string[]): boolean {
  return selectedFys.includes(FY_FILTER_ALL);
}

export function resolveSelectedFyKeys(
  selectedFys: string[],
  availableFyKeys: string[],
): string[] {
  if (isLifetimeFySelection(selectedFys)) return [...availableFyKeys];
  return selectedFys.filter((fy) => fy !== FY_FILTER_ALL && availableFyKeys.includes(fy));
}

export function formatCrossSellFyFilterLabel(
  selectedFys: string[],
  availableFyKeys: string[],
): string {
  if (isLifetimeFySelection(selectedFys)) return "All (lifetime)";
  const keys = resolveSelectedFyKeys(selectedFys, availableFyKeys);
  if (keys.length === 0) return "Select FY";
  if (keys.length === 1) return formatFYLabel(keys[0]);
  return keys.map(formatFYLabel).join(", ");
}

export function getMonthYearPairsForSelectedFys(
  selectedFys: string[],
  availableFyKeys: string[],
): Array<{ month: number; year: number }> {
  const keys = resolveSelectedFyKeys(selectedFys, availableFyKeys);
  const seen = new Set<string>();
  const pairs: Array<{ month: number; year: number }> = [];
  for (const fyKey of keys) {
    for (const pair of getMonthYearPairsForFY(fyKey)) {
      const key = `${pair.year}-${pair.month}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(pair);
    }
  }
  return pairs;
}

export function getFinancialYearStringsForSelectedFys(
  selectedFys: string[],
  availableFyKeys: string[],
): string[] {
  return resolveSelectedFyKeys(selectedFys, availableFyKeys)
    .map(fyKeyToFinancialYearString)
    .filter(Boolean);
}

export function isDateWithinSelectedFys(
  date: Date,
  selectedFys: string[],
  availableFyKeys: string[],
): boolean {
  if (isLifetimeFySelection(selectedFys)) return true;
  return resolveSelectedFyKeys(selectedFys, availableFyKeys).some((fyKey) => {
    const range = getFinancialYearDateRange(fyKey);
    return date >= range.start && date <= range.end;
  });
}

/** Calendar-month windows for expected contract sign date (one per FY × month, or all years when lifetime). */
export function getExpectedContractSignRangesForMonth(
  month: number,
  selectedFys: string[],
  availableFyKeys: string[],
): Array<{ start: Date; end: Date }> {
  if (isLifetimeFySelection(selectedFys)) {
    const ranges: Array<{ start: Date; end: Date }> = [];
    for (let year = 2018; year <= 2032; year++) {
      ranges.push({
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59, 999),
      });
    }
    return ranges;
  }

  return resolveSelectedFyKeys(selectedFys, availableFyKeys).map((fyKey) => {
    const year = getYearForMonthInFY(month, fyKey);
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 0, 23, 59, 59, 999),
    };
  });
}

export function getCreatedAtRangesForSelectedFys(
  selectedFys: string[],
  availableFyKeys: string[],
): Array<{ start: Date; end: Date }> {
  if (isLifetimeFySelection(selectedFys)) return [];
  return resolveSelectedFyKeys(selectedFys, availableFyKeys).map(getFinancialYearDateRange);
}
