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
