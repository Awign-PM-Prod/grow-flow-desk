import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";
import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getPageDataCache, hashPageFilters, loadPersistedFilters, savePersistedFilters, setPageDataCache } from "@/lib/pageSession";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BookOpen, Check, ChevronsUpDown, Minus, SlidersHorizontal } from "lucide-react";
import { PDFGuideDialog } from "@/components/PDFGuideDialog";
import { TeamSelectItems } from "@/components/TeamSelectItems";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatNumber } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  getFinancialYearMonths,
  getFYQuarterMonthYearPairs,
  getNextFYQuarterMonthYearPairs,
  formatMonthYearLong,
  getMonthYearPairsForFY,
} from "./targets/financialYearUtils";
import { isMandateActiveAsOf } from "@/lib/mandateLifecycleLog";
import {
  applyExcludeTestKamFilter,
  fetchTestProfileExclusions,
  filterRowsByTestProfiles,
  filterTargetsByTestProfiles,
  type TestProfileExclusions,
} from "@/lib/dashboardTestAccounts";
import {
  ALL_LOB_OPTIONS,
  expandDashboardLobFilterValues,
  getChartLobOptionsForDashboard,
  getDefaultDashboardLobs,
  getLobDashboardCategoriesForFilter,
  resolveDashboardChartLobKey,
} from "@/lib/teamLob";

const lobOptions = [...ALL_LOB_OPTIONS];

function lobCategorySelectionState(
  selected: string[],
  categoryLobs: readonly string[],
): "none" | "some" | "all" {
  let n = 0;
  for (const l of categoryLobs) {
    if (selected.includes(l)) n += 1;
  }
  if (n === 0) return "none";
  if (n === categoryLobs.length) return "all";
  return "some";
}

const dashboardFilterFocusClass =
  "focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

const dashboardFilterActiveClass = "border-blue-500 bg-blue-50/50";

/** Fit trigger width to selected label; override Select default w-full + line-clamp. */
const dashboardFilterTriggerClass = cn(
  "h-9 w-auto max-w-full shrink-0 gap-1.5 whitespace-nowrap bg-background px-2.5 text-left text-sm [&>span]:line-clamp-none [&>span]:whitespace-nowrap",
  dashboardFilterFocusClass,
);

const dashboardTeamFilterTriggerClass = cn(
  "h-9 w-auto max-w-full shrink-0 gap-1 whitespace-nowrap bg-background px-2 text-left text-sm [&>span]:line-clamp-none [&>span]:whitespace-nowrap",
  dashboardFilterFocusClass,
);

const dashboardFilterButtonClass = cn(
  "inline-flex h-9 w-auto max-w-full shrink-0 items-center gap-1.5 justify-between whitespace-nowrap bg-background px-2.5 text-left text-sm font-normal",
  dashboardFilterFocusClass,
);

function getCurrentFinancialYear(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  return `FY${fyStartYear.toString().slice(-2)}`;
}

// Helper function to extract achieved MCV from monthly_data
// Handles old format (array), new format (number), and string values from JSONB
const getAchievedMcv = (monthRecord: any): number => {
  if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
    // Old format: [plannedMcv, achievedMcv]
    return parseFloat(monthRecord[1]?.toString() || "0") || 0;
  }
  if (typeof monthRecord === "number") {
    return monthRecord;
  }
  if (typeof monthRecord === "string") {
    const parsed = parseFloat(monthRecord);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getAchievedMcvForMonthKey = (
  monthlyData: unknown,
  monthYearKey: string,
): number => {
  if (!monthlyData || typeof monthlyData !== "object" || Array.isArray(monthlyData)) {
    return 0;
  }
  const record = (monthlyData as Record<string, unknown>)[monthYearKey];
  if (record === undefined || record === null) return 0;
  return getAchievedMcv(record);
};

type RollupMandateRow = {
  lifecycle_status?: string | null;
  monthly_data?: unknown;
};

function hasAchievedMcvInPeriod(
  monthlyData: unknown,
  isInPeriod: (monthDate: Date, monthYearKey: string) => boolean,
): boolean {
  if (!monthlyData || typeof monthlyData !== "object" || Array.isArray(monthlyData)) {
    return false;
  }
  for (const [monthYearKey, record] of Object.entries(
    monthlyData as Record<string, unknown>,
  )) {
    if (getAchievedMcv(record) <= 0) continue;
    const parts = monthYearKey.split("-");
    if (parts.length < 2) continue;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (Number.isNaN(year) || Number.isNaN(month)) continue;
    const monthDate = new Date(year, month - 1, 1);
    if (isInPeriod(monthDate, monthYearKey)) return true;
  }
  return false;
}

/** Active mandates, or inactive mandates with achieved MCV in the rollup period. */
function filterMandatesForRollups<T extends RollupMandateRow>(
  mandates: T[] | null | undefined,
  keepInactiveIfHasAchieved: (monthlyData: unknown) => boolean,
): T[] {
  const rows = mandates || [];
  return rows.filter(
    (m) =>
      m.lifecycle_status === "Active" ||
      keepInactiveIfHasAchieved(m.monthly_data),
  );
}

function buildInactiveMandateIdsForTargets(
  inactiveRows: Array<{ id: string; monthly_data?: unknown }> | null | undefined,
  keepInactiveIfHasAchieved: (monthlyData: unknown) => boolean,
): Set<string> {
  const ids = new Set<string>();
  for (const row of inactiveRows || []) {
    if (!row.id) continue;
    if (keepInactiveIfHasAchieved(row.monthly_data)) continue;
    ids.add(row.id);
  }
  return ids;
}

/** Compact rupee labels for horizontal chart value axes */
function formatAxisCurrencyTick(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  return `₹${formatNumber(value)}`;
}

/** Height for horizontal bar charts from category count */
function horizontalBarChartHeight(
  rowCount: number,
  opts?: { min?: number; max?: number; perRow?: number }
): number {
  const { min = 360, max = 720, perRow = 56 } = opts ?? {};
  return Math.min(max, Math.max(min, Math.max(1, rowCount) * perRow));
}

function formatCurrencyLabel(value: number): string {
  if (value === 0) return "0";
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  return `₹${formatNumber(value)}`;
}

/** Single-month target from manager_targets for the mandate-type filter (org-level buckets). */
const managerTargetValueForMandateFilter = (
  existing: number,
  newAc: number,
  filterUpsellStatus: string
): number => {
  if (filterUpsellStatus === "All Cross Sell + Existing") {
    return existing;
  }
  if (filterUpsellStatus === "New Acquisitions") {
    return newAc;
  }
  if (filterUpsellStatus === "All mandate types" || filterUpsellStatus === "all") {
    return existing + newAc;
  }
  if (filterUpsellStatus === "Existing" || filterUpsellStatus === "All Cross Sell") {
    return existing;
  }
  return 0;
};

type ManagerTargetRow = {
  month: number;
  year: number;
  existing_target?: unknown;
  new_ac_target?: unknown;
  team?: string;
};

/** Sum manager_targets for one calendar month across all teams in the fetched rows. */
const sumManagerTargetsForMonth = (
  rows: ManagerTargetRow[] | null | undefined,
  month: number,
  year: number,
  filterUpsellStatus: string
): number => {
  if (!rows?.length) return 0;
  return rows
    .filter((r) => r.month === month && r.year === year)
    .reduce((sum, row) => {
      const existing = parseFloat(String(row.existing_target ?? 0)) || 0;
      const newAc = parseFloat(String(row.new_ac_target ?? 0)) || 0;
      return (
        sum + managerTargetValueForMandateFilter(existing, newAc, filterUpsellStatus)
      );
    }, 0);
};

/** Filter monthly_targets rows to match the dashboard mandate-type (upsell) filter. */
const filterMonthlyTargetsByUpsellStatus = (
  targets: any[],
  filterUpsellStatus: string,
  mandateTypeById: Record<string, string>
): any[] => {
  return targets.filter((target: any) => {
    if (target.target_type === "new_cross_sell") {
      if (
        filterUpsellStatus === "Existing" ||
        filterUpsellStatus === "New Acquisitions"
      ) {
        return false;
      }
      return (
        filterUpsellStatus === "All Cross Sell" ||
        filterUpsellStatus === "All Cross Sell + Existing" ||
        filterUpsellStatus === "All mandate types" ||
        filterUpsellStatus === "all"
      );
    }

    if (target.target_type === "existing" && target.mandate_id) {
      const mandateType =
        mandateTypeById[target.mandate_id] ??
        (Array.isArray(target.mandates)
          ? target.mandates[0]?.type
          : target.mandates?.type);
      if (!mandateType) return false;

      if (filterUpsellStatus === "Existing") return mandateType === "Existing";
      if (filterUpsellStatus === "All Cross Sell") {
        return mandateType === "New Cross Sell";
      }
      if (filterUpsellStatus === "All Cross Sell + Existing") {
        return mandateType === "Existing" || mandateType === "New Cross Sell";
      }
      if (filterUpsellStatus === "New Acquisitions") {
        return mandateType === "New Acquisition";
      }
      return (
        filterUpsellStatus === "All mandate types" || filterUpsellStatus === "all"
      );
    }

    return false;
  });
};

const sumMonthlyTargetValues = (
  targets: any[],
  inactiveMandateIds: Set<string>,
  periodFilter: (monthDate: Date, monthYearKey: string) => boolean
): number => {
  return targets.reduce((sum, target) => {
    if (
      target.mandate_id &&
      inactiveMandateIds.has(target.mandate_id as string)
    ) {
      return sum;
    }
    const monthDate = new Date(target.year, target.month - 1, 1);
    const monthYearKey = `${target.year}-${String(target.month).padStart(2, "0")}`;
    if (!periodFilter(monthDate, monthYearKey)) return sum;
    const value = parseFloat(target.target?.toString() || "0") || 0;
    return sum + value;
  }, 0);
};

function endOfCalendarMonth(year: number, month1to12: number): Date {
  return new Date(year, month1to12, 0, 23, 59, 59, 999);
}

function getCurrentFinancialYearLabel(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  return `FY${fyStartYear.toString().slice(-2)}`;
}

/** Point-in-time dates for upsell tables: snapshot (Group B/C) and prev/curr month (Performance). */
function getUpsellDateContext(
  filterFinancialYear: string,
  filterDashboardMonth: string,
  fyDateRange: { start: Date; end: Date },
  fyMonthsList: Array<{ key: string; year: number; month: number }>,
): {
  snapshotAsOf: Date;
  perfCurrMonthEnd: Date;
  perfPrevMonthEnd: Date;
  maxCreatedAt: Date;
} {
  const scopedMonth =
    filterDashboardMonth !== "all"
      ? fyMonthsList.find((m) => m.key === filterDashboardMonth) ?? null
      : null;

  const now = new Date();
  const currentFY = getCurrentFinancialYearLabel();

  let snapshotAsOf: Date;
  let perfCurrMonthEnd: Date;
  let perfPrevMonthEnd: Date;

  if (scopedMonth) {
    snapshotAsOf = endOfCalendarMonth(scopedMonth.year, scopedMonth.month);
    perfCurrMonthEnd = snapshotAsOf;
    const prevMonth1to12 = scopedMonth.month === 1 ? 12 : scopedMonth.month - 1;
    const prevYear =
      scopedMonth.month === 1 ? scopedMonth.year - 1 : scopedMonth.year;
    perfPrevMonthEnd = endOfCalendarMonth(prevYear, prevMonth1to12);
  } else if (filterFinancialYear === currentFY) {
    snapshotAsOf = now;
    perfCurrMonthEnd = endOfCalendarMonth(now.getFullYear(), now.getMonth() + 1);
    const prevMonth1to12 = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    perfPrevMonthEnd = endOfCalendarMonth(prevYear, prevMonth1to12);
  } else {
    snapshotAsOf = fyDateRange.end;
    perfCurrMonthEnd = fyDateRange.end;
    perfPrevMonthEnd = endOfCalendarMonth(
      fyDateRange.end.getFullYear(),
      fyDateRange.end.getMonth(),
    );
  }

  const maxCreatedAt = new Date(
    Math.max(
      snapshotAsOf.getTime(),
      perfCurrMonthEnd.getTime(),
      perfPrevMonthEnd.getTime(),
    ),
  );

  return { snapshotAsOf, perfCurrMonthEnd, perfPrevMonthEnd, maxCreatedAt };
}

function filterMandatesActiveAsOf(mandates: any[] | null | undefined, asOf: Date): any[] {
  return (mandates || []).filter((mandate) =>
    isMandateActiveAsOf(mandate.created_at, mandate.lifecycle_status_log, asOf),
  );
}

type DashboardPersistedFilters = {
  filterDashboardMonth: string;
  filterFinancialYear: string;
  filterUpsellStatus: string;
  selectedLobs: string[];
  filterKam: string;
  filterNso: string;
  selectedTeam: "all" | "ce" | "staffing" | "experts" | null;
};

type DashboardDataCache = {
  activeMandatesCount: number;
  allMandatesCount: number;
  mandatesThisMonth: number;
  totalAccounts: number;
  accountsWithActiveMandates: number;
  avgAwignShare: number | null;
  overlapFactor: number | null;
  mcvPlanned: number;
  ffmAchieved: number;
  ffmAchievedFyPercentage: number;
  mcvThisQuarter: number;
  mcvLastMonth: number;
  targetMcvNextQuarter: number;
  annualAchieved: number;
  annualTarget: number;
  quarterAchieved: number;
  quarterTarget: number;
  currentMonthAchieved: number;
  currentMonthTarget: number;
  droppedSalesData: Array<{ name: string; value: number; color: string }>;
  mcvTierData: Array<{
    category: string;
    tier: string;
    rowType: string;
    lastQuarter?: string | number;
    [key: string]: string | number | undefined;
  }>;
  tierMonthColumns: Array<{ month: number; year: number; key: string; label: string }>;
  rawGroupBMandates: any[];
  rawGroupCMandates: any[];
  rawAllMandates: any[];
  accountMcvTierMapState: Record<string, string | null>;
  lobSalesPerformance: Array<{ lob: string; targetMpv: number; achievedMpv: number }>;
  kamSalesPerformance: Array<{ kamId: string; kamName: string; targetMpv: number; achievedMpv: number }>;
  mandatesPerLobChart: Array<{ lob: string; count: number }>;
  maxMcvPerLobChart: Array<{ lob: string; sumMaxMcv: number }>;
};

const defaultDashboardFilters = (): DashboardPersistedFilters => ({
  filterDashboardMonth: "all",
  filterFinancialYear: getCurrentFinancialYear(),
  filterUpsellStatus: "All mandate types",
  selectedLobs: [],
  filterKam: "all",
  filterNso: "all",
  selectedTeam: null,
});

export default function Dashboard() {
  const { user, hasRole, isNSO, isTeamAdmin, canSelectAllTeams, team: userTeam } = useAuth();
  const isKAM = hasRole("kam");
  const savedDashboardFilters = loadPersistedFilters<DashboardPersistedFilters>("dashboard-filters");
  const initialDashboardFilters = savedDashboardFilters
    ? { ...defaultDashboardFilters(), ...savedDashboardFilters }
    : defaultDashboardFilters();

  const [selectedTeam, setSelectedTeam] = useState<"all" | "ce" | "staffing" | "experts" | null>(
    initialDashboardFilters.selectedTeam,
  );

  const chartLobOptions = useMemo(
    () =>
      getChartLobOptionsForDashboard(lobOptions, {
        canSelectAllTeams,
        selectedTeam,
        userTeam,
      }),
    [canSelectAllTeams, selectedTeam, userTeam],
  );

  const lobDashboardCategories = useMemo(
    () =>
      getLobDashboardCategoriesForFilter(
        userTeam,
        canSelectAllTeams,
        selectedTeam,
      ),
    [userTeam, canSelectAllTeams, selectedTeam],
  );

  const dashboardLobOptions = chartLobOptions;
  const [loading, setLoading] = useState(true);
  /** Active mandates in scope (filters applied); shown as x in the Active Mandates card. */
  const [activeMandatesCount, setActiveMandatesCount] = useState(0);
  /** All mandates in scope incl. inactive (filters applied); shown as y in the Active Mandates card. */
  const [allMandatesCount, setAllMandatesCount] = useState(0);
  const [mandatesThisMonth, setMandatesThisMonth] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [accountsWithActiveMandates, setAccountsWithActiveMandates] = useState(0);
  const [avgAwignShare, setAvgAwignShare] = useState<number | null>(null);
  const [overlapFactor, setOverlapFactor] = useState<number | null>(null);
  const [mcvPlanned, setMcvPlanned] = useState<number>(0);
  const [ffmAchieved, setFfmAchieved] = useState<number>(0);
  const [ffmAchievedFyPercentage, setFfmAchievedFyPercentage] = useState<number>(0);
  const [mcvThisQuarter, setMcvThisQuarter] = useState<number>(0);
  const [mcvLastMonth, setMcvLastMonth] = useState<number>(0);
  const [targetMcvNextQuarter, setTargetMcvNextQuarter] = useState<number>(0);
  const [annualAchieved, setAnnualAchieved] = useState<number>(0);
  const [annualTarget, setAnnualTarget] = useState<number>(0);
  const [quarterAchieved, setQuarterAchieved] = useState<number>(0);
  const [quarterTarget, setQuarterTarget] = useState<number>(0);
  const [currentMonthAchieved, setCurrentMonthAchieved] = useState<number>(0);
  const [currentMonthTarget, setCurrentMonthTarget] = useState<number>(0);
  const [droppedSalesData, setDroppedSalesData] = useState<Array<{
    name: string;
    value: number;
    color: string;
  }>>([]);
  const [mcvTierData, setMcvTierData] = useState<Array<{
    category: string;
    tier: string;
    rowType: string;
    lastQuarter?: string | number;
    [key: string]: string | number | undefined;
  }>>([]);
  const [tierMonthColumns, setTierMonthColumns] = useState<Array<{
    month: number;
    year: number;
    key: string;
    label: string;
  }>>([]);
  const [mcvTierFilter, setMcvTierFilter] = useState<string>("all");
  const [companySizeTierFilter, setCompanySizeTierFilter] = useState<string>("all");
  const [upsellMcvTierFilter, setUpsellMcvTierFilter] = useState<string>("All MCV Tiers");
  // Raw data for upsell sections (before MCV tier filtering)
  const [rawGroupBMandates, setRawGroupBMandates] = useState<any[]>([]);
  const [rawGroupCMandates, setRawGroupCMandates] = useState<any[]>([]);
  const [rawAllMandates, setRawAllMandates] = useState<any[]>([]);
  const [accountMcvTierMapState, setAccountMcvTierMapState] = useState<Record<string, string | null>>({});
  // Formatted data (after MCV tier filtering)
  const [upsellGroupB, setUpsellGroupB] = useState<Array<{ status: string; count: number; revenue: string; accounts: number }>>([]);
  const [upsellGroupC, setUpsellGroupC] = useState<Array<{ status: string; count: number; revenue: string; accounts: number }>>([]);
  const [upsellPerformance, setUpsellPerformance] = useState<Array<{ 
    group: string; 
    prevCount: number; 
    currCount: number; 
    countDiff: string; 
    prevRev: string; 
    currRev: string; 
    revDiff: string;
    revDiffNumeric: number;
    prevAcc: number; 
    currAcc: number; 
    accDiff: string 
  }>>([]);
  const [lobSalesPerformance, setLobSalesPerformance] = useState<Array<{
    lob: string;
    targetMpv: number;
    achievedMpv: number;
  }>>([]);
  const [kamSalesPerformance, setKamSalesPerformance] = useState<Array<{
    kamId: string;
    kamName: string;
    targetMpv: number;
    achievedMpv: number;
  }>>([]);
  const [mandatesPerLobChart, setMandatesPerLobChart] = useState<
    Array<{ lob: string; count: number }>
  >([]);
  const [maxMcvPerLobChart, setMaxMcvPerLobChart] = useState<
    Array<{ lob: string; sumMaxMcv: number }>
  >([]);
  // Filter states
  /** "all" = full FY; otherwise month key e.g. "2025-04" from getFinancialYearMonths */
  const [filterDashboardMonth, setFilterDashboardMonth] = useState<string>(
    initialDashboardFilters.filterDashboardMonth,
  );
  const [filterFinancialYear, setFilterFinancialYear] = useState<string>(
    initialDashboardFilters.filterFinancialYear,
  );
  const [filterUpsellStatus, setFilterUpsellStatus] = useState<string>(
    initialDashboardFilters.filterUpsellStatus,
  );
  const [selectedLobs, setSelectedLobs] = useState<string[]>(initialDashboardFilters.selectedLobs);
  const [lobFilterOpen, setLobFilterOpen] = useState(false);
  const [filterKam, setFilterKam] = useState<string>(initialDashboardFilters.filterKam);
  const [filterNso, setFilterNso] = useState<string>(initialDashboardFilters.filterNso);

  useEffect(() => {
    savePersistedFilters("dashboard-filters", {
      filterDashboardMonth,
      filterFinancialYear,
      filterUpsellStatus,
      selectedLobs,
      filterKam,
      filterNso,
      selectedTeam,
    });
  }, [
    filterDashboardMonth,
    filterFinancialYear,
    filterUpsellStatus,
    selectedLobs,
    filterKam,
    filterNso,
    selectedTeam,
  ]);
  const [kams, setKams] = useState<Array<{ id: string; full_name: string }>>([]);
  const [nsos, setNsos] = useState<Array<{ mail_id: string; first_name: string; last_name: string }>>([]);
  const [kamSearch, setKamSearch] = useState("");
  const [nsoSearch, setNsoSearch] = useState("");
  const [guideDialogOpen, setGuideDialogOpen] = useState(false);

  /** Mandates with lifecycle_status = Inactive — their monthly_targets rows are excluded from rollups. */
  const inactiveMandateIdsRef = useRef<Set<string>>(new Set());
  const testExclusionsRef = useRef<TestProfileExclusions>({
    kamIds: new Set(),
    nsoEmails: new Set(),
  });

  // Default dashboard team scope to the user's own team; global superadmins can switch.
  useEffect(() => {
    if (canSelectAllTeams) {
      setSelectedTeam((prev) => prev ?? "all");
      return;
    }
    if (!userTeam) return;
    // Team admins are always scoped to their assigned team (same as mandates page RLS).
    if (isTeamAdmin) {
      setSelectedTeam(userTeam);
      return;
    }
    setSelectedTeam((prev) => prev ?? userTeam);
  }, [canSelectAllTeams, userTeam, isTeamAdmin]);

  // Scope LoB filter to team (CE excludes Experts only; staffing/experts auto-select).
  // Team admins: no default LoB filter so all team mandates match (LoB filter is optional).
  useEffect(() => {
    if (canSelectAllTeams) return;
    if (isTeamAdmin) {
      setSelectedLobs([]);
      return;
    }
    const defaults = getDefaultDashboardLobs(userTeam, canSelectAllTeams);
    setSelectedLobs(defaults);
  }, [canSelectAllTeams, userTeam, isTeamAdmin]);

  // When admin changes team, drop LoB selections outside that team's LoBs
  useEffect(() => {
    if (!canSelectAllTeams) return;
    setSelectedLobs((prev) => {
      const pruned = prev.filter((l) => chartLobOptions.includes(l));
      if (pruned.length === prev.length) return prev;
      return pruned;
    });
  }, [canSelectAllTeams, chartLobOptions]);

  // Set filterKam to current user's ID when they're a KAM
  useEffect(() => {
    if (isKAM && user?.id) {
      setFilterKam(user.id);
    }
  }, [isKAM, user?.id]);

  useEffect(() => {
    setFilterDashboardMonth("all");
  }, [filterFinancialYear]);

  // NSO users: no NSO filter on dashboard (RLS already scopes data)
  useEffect(() => {
    if (!isNSO) return;
    setFilterNso("all");
  }, [isNSO]);

  const dashboardFilterHash = useMemo(
    () =>
      hashPageFilters({
        filterFinancialYear,
        filterDashboardMonth,
        filterUpsellStatus,
        filterKam,
        filterNso,
        selectedTeam,
        selectedLobs: [...selectedLobs].sort(),
        userId: user?.id,
      }),
    [
      filterFinancialYear,
      filterDashboardMonth,
      filterUpsellStatus,
      filterKam,
      filterNso,
      selectedTeam,
      selectedLobs,
      user?.id,
    ],
  );

  const applyDashboardCache = useCallback((cached: DashboardDataCache) => {
    setActiveMandatesCount(cached.activeMandatesCount);
    setAllMandatesCount(cached.allMandatesCount);
    setMandatesThisMonth(cached.mandatesThisMonth);
    setTotalAccounts(cached.totalAccounts);
    setAccountsWithActiveMandates(
      cached.accountsWithActiveMandates ?? cached.totalAccounts,
    );
    setAvgAwignShare(cached.avgAwignShare);
    setOverlapFactor(cached.overlapFactor);
    setMcvPlanned(cached.mcvPlanned);
    setFfmAchieved(cached.ffmAchieved);
    setFfmAchievedFyPercentage(cached.ffmAchievedFyPercentage);
    setMcvThisQuarter(cached.mcvThisQuarter);
    setMcvLastMonth(cached.mcvLastMonth);
    setTargetMcvNextQuarter(cached.targetMcvNextQuarter);
    setAnnualAchieved(cached.annualAchieved);
    setAnnualTarget(cached.annualTarget);
    setQuarterAchieved(cached.quarterAchieved);
    setQuarterTarget(cached.quarterTarget);
    setCurrentMonthAchieved(cached.currentMonthAchieved);
    setCurrentMonthTarget(cached.currentMonthTarget);
    setDroppedSalesData(cached.droppedSalesData);
    setMcvTierData(cached.mcvTierData);
    setTierMonthColumns(cached.tierMonthColumns);
    setRawGroupBMandates(cached.rawGroupBMandates);
    setRawGroupCMandates(cached.rawGroupCMandates);
    setRawAllMandates(cached.rawAllMandates);
    setAccountMcvTierMapState(cached.accountMcvTierMapState);
    setLobSalesPerformance(cached.lobSalesPerformance);
    setKamSalesPerformance(cached.kamSalesPerformance);
    setMandatesPerLobChart(cached.mandatesPerLobChart);
    setMaxMcvPerLobChart(cached.maxMcvPerLobChart);
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    const cached = getPageDataCache<DashboardDataCache>("dashboard", dashboardFilterHash);
    if (cached) {
      applyDashboardCache(cached);
      setLoading(false);
      return;
    }
    fetchDashboardData();
    if (isKAM) return;
    if (isNSO) {
      fetchKams();
      return;
    }
    fetchKams();
    fetchNsos();
  }, [
    dashboardFilterHash,
    selectedTeam,
    applyDashboardCache,
    filterFinancialYear,
    filterDashboardMonth,
    filterUpsellStatus,
    filterKam,
    filterNso,
    isKAM,
    isNSO,
    selectedLobs,
  ]);

  useEffect(() => {
    if (loading || !selectedTeam) return;
    setPageDataCache("dashboard", dashboardFilterHash, {
      activeMandatesCount,
      allMandatesCount,
      mandatesThisMonth,
      totalAccounts,
      accountsWithActiveMandates,
      avgAwignShare,
      overlapFactor,
      mcvPlanned,
      ffmAchieved,
      ffmAchievedFyPercentage,
      mcvThisQuarter,
      mcvLastMonth,
      targetMcvNextQuarter,
      annualAchieved,
      annualTarget,
      quarterAchieved,
      quarterTarget,
      currentMonthAchieved,
      currentMonthTarget,
      droppedSalesData,
      mcvTierData,
      tierMonthColumns,
      rawGroupBMandates,
      rawGroupCMandates,
      rawAllMandates,
      accountMcvTierMapState,
      lobSalesPerformance,
      kamSalesPerformance,
      mandatesPerLobChart,
      maxMcvPerLobChart,
    });
  }, [
    loading,
    dashboardFilterHash,
    selectedTeam,
    activeMandatesCount,
    allMandatesCount,
    mandatesThisMonth,
    totalAccounts,
    accountsWithActiveMandates,
    avgAwignShare,
    overlapFactor,
    mcvPlanned,
    ffmAchieved,
    ffmAchievedFyPercentage,
    mcvThisQuarter,
    mcvLastMonth,
    targetMcvNextQuarter,
    annualAchieved,
    annualTarget,
    quarterAchieved,
    quarterTarget,
    currentMonthAchieved,
    currentMonthTarget,
    droppedSalesData,
    mcvTierData,
    tierMonthColumns,
    rawGroupBMandates,
    rawGroupCMandates,
    rawAllMandates,
    accountMcvTierMapState,
    lobSalesPerformance,
    kamSalesPerformance,
    mandatesPerLobChart,
    maxMcvPerLobChart,
  ]);

  // Helper function to convert FY string to display format (e.g., "FY25" -> "FY 2025-26")
  const formatFYForDisplay = (fyString: string): string => {
    const yearMatch = fyString.match(/FY(\d{2})/);
    if (!yearMatch) {
      // If it's already in "2025-26" format, add "FY " prefix
      if (fyString.match(/^\d{4}-\d{2}$/)) {
        return `FY ${fyString}`;
      }
      return fyString; // Return as-is if format is unrecognized
    }
    
    const yearDigits = parseInt(yearMatch[1], 10);
    const startYear = 2000 + yearDigits;
    const endYear = (startYear + 1).toString().slice(-2);
    
    return `FY ${startYear}-${endYear}`;
  };

  const dashboardMonthOptions = useMemo(
    () => getFinancialYearMonths(filterFinancialYear),
    [filterFinancialYear]
  );

  /** FY quarter label for charts (uses selected month when month filter is set, else today). */
  const dashboardQuarterLabel = useMemo(() => {
    const m =
      filterDashboardMonth === "all"
        ? new Date().getMonth() + 1
        : dashboardMonthOptions.find((c) => c.key === filterDashboardMonth)?.month ??
          new Date().getMonth() + 1;
    if (m >= 4 && m <= 6) return "Q1";
    if (m >= 7 && m <= 9) return "Q2";
    if (m >= 10 && m <= 12) return "Q3";
    return "Q4";
  }, [filterDashboardMonth, dashboardMonthOptions]);

  /** Card/chart subtitles aligned with month filter (matches fetchDashboardData ref logic). */
  const dashboardPeriodLabels = useMemo(() => {
    const today = new Date();
    const calendarMonth = today.getMonth() + 1;
    const calendarYear = today.getFullYear();
    const scoped =
      filterDashboardMonth !== "all"
        ? dashboardMonthOptions.find((c) => c.key === filterDashboardMonth) ?? null
        : null;
    const isScoped = scoped !== null;
    const refMonth = isScoped ? scoped.month : calendarMonth;
    const refYear = isScoped ? scoped.year : calendarYear;
    const monthNamesShort = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const targetMcvMonthFooter =
      isScoped && scoped ? scoped.label : formatMonthYearLong(calendarMonth, calendarYear);
    const targetMcvFullFyFooter = (() => {
      const yearMatch = filterFinancialYear.match(/FY(\d{2})/);
      if (!yearMatch) return formatFYForDisplay(filterFinancialYear);
      const startYear = 2000 + parseInt(yearMatch[1], 10);
      const endYear = startYear + 1;
      return `FY ${startYear} - ${endYear}`;
    })();
    const targetMcvFooter = isScoped ? targetMcvMonthFooter : targetMcvFullFyFooter;

    const quarterPairs = getFYQuarterMonthYearPairs(refMonth, refYear);
    const quarterMonthsFooter = quarterPairs
      .map((p) => `${monthNamesShort[p.month - 1]} ${p.year}`)
      .join(", ");

    const prevM = refMonth === 1 ? 12 : refMonth - 1;
    const prevY = refMonth === 1 ? refYear - 1 : refYear;
    const lastMonthFooter = formatMonthYearLong(prevM, prevY);

    const nextQPairs = getNextFYQuarterMonthYearPairs(refMonth, refYear);
    const nextQuarterFooter = nextQPairs
      .map((p) => `${monthNamesShort[p.month - 1]} ${p.year}`)
      .join(", ");

    const currentMonthChartTitle = formatMonthYearLong(refMonth, refYear);

    return {
      isScoped,
      targetMcvFooter,
      targetMcvMonthFooter,
      quarterMonthsFooter,
      lastMonthFooter,
      nextQuarterFooter,
      currentMonthChartTitle,
      annualChartSelectedHint:
        isScoped && scoped ? `Selected: ${scoped.label}` : null,
    };
  }, [filterDashboardMonth, dashboardMonthOptions, filterFinancialYear]);

  // Helper function to convert FY string to date range
  const getFinancialYearDateRange = (fyString: string): { start: Date; end: Date } => {
    // Extract year from FY string (e.g., "FY26" -> 2025)
    const yearMatch = fyString.match(/FY(\d{2})/);
    if (!yearMatch) {
      // Default to current year if parsing fails
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
      return {
        start: new Date(startYear, 3, 1), // April 1
        end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999), // March 31
      };
    }
    
    const yearDigits = parseInt(yearMatch[1], 10);
    // Convert 2-digit year to 4-digit (e.g., 26 -> 2025, assuming 2000s)
    const startYear = 2000 + yearDigits;
    
    return {
      start: new Date(startYear, 3, 1), // April 1
      end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999), // March 31
    };
  };

  const upsellDateContext = useMemo(
    () =>
      getUpsellDateContext(
        filterFinancialYear,
        filterDashboardMonth,
        getFinancialYearDateRange(filterFinancialYear),
        dashboardMonthOptions,
      ),
    [filterFinancialYear, filterDashboardMonth, dashboardMonthOptions],
  );

  const isKamFilterActive = (kam: string) => kam !== "" && kam !== "all";
  const isNsoFilterActive = (nso: string) => nso !== "" && nso !== "all";
  const isTeamFilterActive =
    canSelectAllTeams && (selectedTeam ?? "all") !== "all";
  const isFinancialYearFilterActive =
    filterFinancialYear !== getCurrentFinancialYear();
  const isMonthFilterActive = filterDashboardMonth !== "all";
  const isLobFilterActive = selectedLobs.length > 0;
  const isMandateTypeFilterActive =
    filterUpsellStatus !== "All mandate types";

  const hasActiveDashboardFilters =
    isTeamFilterActive ||
    isFinancialYearFilterActive ||
    isMonthFilterActive ||
    isLobFilterActive ||
    isMandateTypeFilterActive ||
    (!isKAM && isKamFilterActive(filterKam)) ||
    (!isKAM && !isNSO && isNsoFilterActive(filterNso));

  const clearDashboardFilters = () => {
    if (canSelectAllTeams) {
      setSelectedTeam("all");
    }
    setFilterFinancialYear(getCurrentFinancialYear());
    setFilterDashboardMonth("all");
    if (isTeamAdmin || canSelectAllTeams) {
      setSelectedLobs([]);
    } else if (userTeam) {
      setSelectedLobs(getDefaultDashboardLobs(userTeam, canSelectAllTeams));
    } else {
      setSelectedLobs([]);
    }
    setFilterUpsellStatus("All mandate types");
    if (!isKAM) {
      setFilterKam("all");
    }
    if (!isKAM && !isNSO) {
      setFilterNso("all");
    }
    setKamSearch("");
    setNsoSearch("");
  };

  const hasPersonFilter = () =>
    (isKAM && Boolean(user?.id)) ||
    isKamFilterActive(filterKam) ||
    isNsoFilterActive(filterNso);

  /** Target MCV card: mandate upsell targets only when a KAM/NSO filter is explicitly active. */
  const isKamOrNsoTargetMcvFilterActive = () =>
    isKamFilterActive(filterKam) || isNsoFilterActive(filterNso);

  // Helper function to apply status filter to a Supabase query
  // Note: When a specific NSO is selected, skip status filter since NSOs only exist for "New Acquisition" mandates
  const applyStatusFilter = (query: any, statusFilter: string, nsoFilterActive?: boolean): any => {
    if (nsoFilterActive) {
      return query;
    }
    
    if (statusFilter === "all" || statusFilter === "All mandate types") {
      return query; // No filter applied - show all mandate types
    } else if (statusFilter === "Existing") {
      return query.eq("type", "Existing");
    } else if (statusFilter === "All Cross Sell") {
      return query.eq("type", "New Cross Sell");
    } else if (statusFilter === "All Cross Sell + Existing") {
      return query.in("type", ["New Cross Sell", "Existing"]);
    } else if (statusFilter === "New Acquisitions") {
      return query.eq("type", "New Acquisition");
    }
    return query; // Default: no filter
  };

  // Helper function to apply KAM/NSO filter to a Supabase query
  const applyKamFilter = (query: any, kamFilter: string, nsoFilter: string): any => {
    if (isKAM && user?.id) {
      return query.eq("kam_id", user.id);
    }

    let filtered = query;
    if (isKamFilterActive(kamFilter)) {
      filtered = filtered.eq("kam_id", kamFilter);
    }
    if (isNsoFilterActive(nsoFilter)) {
      filtered = filtered
        .eq("type", "New Acquisition")
        .eq("new_sales_owner", nsoFilter);
    }
    return filtered;
  };

  const applyLobFilter = (query: any, column: string = "lob"): any => {
    if (selectedLobs.length === 0) return query;
    return query.in(column, expandDashboardLobFilterValues(selectedLobs));
  };

  // Helper function to filter targets by KAM/NSO client-side
  const filterTargetsByKamNso = (targets: any[]): any[] => {
    if (!targets || targets.length === 0) return targets;

    let filteredByTest = filterTargetsByTestProfiles(
      targets,
      testExclusionsRef.current,
    );

    const inactive = inactiveMandateIdsRef.current;
    let filteredByLifecycle = filteredByTest.filter(
      (t: any) => !t.mandate_id || !inactive.has(t.mandate_id as string)
    );
    
    const kamActive = isKamFilterActive(filterKam);
    const nsoActive = isNsoFilterActive(filterNso);

    if (!kamActive && !nsoActive) {
      return filteredByLifecycle;
    }

    return filteredByLifecycle.filter((target: any) => {
      const mandate = Array.isArray(target.mandates) ? target.mandates[0] : target.mandates;

      const matchesKam =
        !kamActive ||
        target.kam_id === filterKam ||
        (target.mandate_id && mandate && mandate.kam_id === filterKam);

      const matchesNso =
        !nsoActive ||
        target.nso_mail_id === filterNso ||
        (target.mandate_id &&
          mandate &&
          mandate.type === "New Acquisition" &&
          mandate.new_sales_owner === filterNso);

      return matchesKam && matchesNso;
    });
  };

  // Helper function to filter mandates by account MCV Tier
  // This function uses a pre-fetched accountMcvTierMap to avoid multiple queries
  const filterMandatesByMcvTier = (
    mandates: any[],
    accountMcvTierMap: Record<string, string | null>
  ): any[] => {
    if (!mandates || mandates.length === 0) return mandates;
    if (upsellMcvTierFilter === "All MCV Tiers") return mandates;

    // Ensure accountMcvTierMap is defined
    if (!accountMcvTierMap) {
      return mandates;
    }

    // Determine the target tier value
    const targetTier = upsellMcvTierFilter === "MCV Tier 1" ? "Tier 1" : "Tier 2";

    // Filter mandates where account's MCV Tier matches the filter
    const filtered = mandates.filter((mandate) => {
      if (!mandate.account_id) return false;
      const accountTier = accountMcvTierMap[mandate.account_id];
      // Only include if the account's tier matches the target tier
      // Accounts with null/undefined mcv_tier will be excluded when filtering by specific tier
      return accountTier === targetTier;
    });

    return filtered;
  };

  // Process Group B upsell data with MCV tier + active-as-of filters applied client-side
  const processedUpsellGroupB = useMemo(() => {
    const activeGroupBMandates = filterMandatesActiveAsOf(
      rawGroupBMandates,
      upsellDateContext.snapshotAsOf,
    );
    const filteredGroupBMandates = filterMandatesByMcvTier(
      activeGroupBMandates,
      accountMcvTierMapState,
    );

    const groupBData: Record<string, { count: number; revenue: number; accountIds: Set<string> }> = {};

    if (filteredGroupBMandates && filteredGroupBMandates.length > 0) {
      filteredGroupBMandates.forEach((mandate) => {
        const status = mandate.upsell_action_status || "Not Set";
        if (!groupBData[status]) {
          groupBData[status] = { count: 0, revenue: 0, accountIds: new Set() };
        }
        groupBData[status].count++;
        if (mandate.revenue_mcv) {
          groupBData[status].revenue += parseFloat(mandate.revenue_mcv.toString()) || 0;
        }
        if (mandate.account_id) {
          groupBData[status].accountIds.add(mandate.account_id);
        }
      });
    }

    return ["Not Started", "Ongoing", "Done", "Not Set"].map((status) => {
      const data = groupBData[status] || { count: 0, revenue: 0, accountIds: new Set() };
      const revenueInLakhs = data.revenue / 100000;
      const revenueDisplay = revenueInLakhs >= 1 
        ? `₹${revenueInLakhs.toFixed(1)}L` 
        : `₹${Math.round(data.revenue).toLocaleString("en-IN")}`;
      
      return {
        status,
        count: data.count,
        revenue: revenueDisplay,
        accounts: data.accountIds.size,
      };
    });
  }, [
    rawGroupBMandates,
    accountMcvTierMapState,
    upsellMcvTierFilter,
    upsellDateContext.snapshotAsOf,
  ]);

  // Process Group C upsell data with MCV tier + active-as-of filters applied client-side
  const processedUpsellGroupC = useMemo(() => {
    const activeGroupCMandates = filterMandatesActiveAsOf(
      rawGroupCMandates,
      upsellDateContext.snapshotAsOf,
    );
    const filteredGroupCMandates = filterMandatesByMcvTier(
      activeGroupCMandates,
      accountMcvTierMapState,
    );

    const groupCData: Record<string, { count: number; revenue: number; accountIds: Set<string> }> = {};

    if (filteredGroupCMandates && filteredGroupCMandates.length > 0) {
      filteredGroupCMandates.forEach((mandate) => {
        const status = mandate.upsell_action_status || "Not Set";
        if (!groupCData[status]) {
          groupCData[status] = { count: 0, revenue: 0, accountIds: new Set() };
        }
        groupCData[status].count++;
        if (mandate.revenue_mcv) {
          groupCData[status].revenue += parseFloat(mandate.revenue_mcv.toString()) || 0;
        }
        if (mandate.account_id) {
          groupCData[status].accountIds.add(mandate.account_id);
        }
      });
    }

    return ["Not Started", "Ongoing", "Done", "Not Set"].map((status) => {
      const data = groupCData[status] || { count: 0, revenue: 0, accountIds: new Set() };
      const revenueInLakhs = data.revenue / 100000;
      const revenueDisplay = revenueInLakhs >= 1 
        ? `₹${revenueInLakhs.toFixed(1)}L` 
        : `₹${Math.round(data.revenue).toLocaleString("en-IN")}`;
      
      return {
        status,
        count: data.count,
        revenue: revenueDisplay,
        accounts: data.accountIds.size,
      };
    });
  }, [
    rawGroupCMandates,
    accountMcvTierMapState,
    upsellMcvTierFilter,
    upsellDateContext.snapshotAsOf,
  ]);

  // Process upsell performance: mandates active at prev vs curr month-end (not created_at)
  const processedUpsellPerformance = useMemo(() => {
    const mcvFilteredMandates = filterMandatesByMcvTier(
      rawAllMandates,
      accountMcvTierMapState,
    );
    const { perfPrevMonthEnd, perfCurrMonthEnd } = upsellDateContext;

    const prevMonthActive = filterMandatesActiveAsOf(mcvFilteredMandates, perfPrevMonthEnd);
    const currMonthActive = filterMandatesActiveAsOf(mcvFilteredMandates, perfCurrMonthEnd);

    const retentionTypes = [
      ...new Set([
        ...prevMonthActive.map((m: any) => m.retention_type || "Not Set"),
        ...currMonthActive.map((m: any) => m.retention_type || "Not Set"),
      ]),
    ].sort();

    const performanceData: Array<{
      group: string;
      prevCount: number;
      currCount: number;
      prevRev: number;
      currRev: number;
      prevAcc: Set<string>;
      currAcc: Set<string>;
    }> = [];

    retentionTypes.forEach((retentionType) => {
      const prevMonthMandates = prevMonthActive.filter(
        (m: any) => (m.retention_type || "Not Set") === retentionType,
      );
      const currMonthMandates = currMonthActive.filter(
        (m: any) => (m.retention_type || "Not Set") === retentionType,
      );

      // Calculate previous month metrics
      const prevRev = prevMonthMandates.reduce((sum: number, m: any) => {
        return sum + (parseFloat(m.revenue_mcv?.toString() || "0") || 0);
      }, 0);
      const prevAccSet = new Set(prevMonthMandates.map((m: any) => m.account_id).filter(Boolean));

      // Calculate current month metrics
      const currRev = currMonthMandates.reduce((sum: number, m: any) => {
        return sum + (parseFloat(m.revenue_mcv?.toString() || "0") || 0);
      }, 0);
      const currAccSet = new Set(currMonthMandates.map((m: any) => m.account_id).filter(Boolean));

      performanceData.push({
        group: retentionType,
        prevCount: prevMonthMandates.length,
        currCount: currMonthMandates.length,
        prevRev,
        currRev,
        prevAcc: prevAccSet,
        currAcc: currAccSet,
      });
    });

    // Calculate Total row
    const totalPrevCount = performanceData.reduce((sum, d) => sum + d.prevCount, 0);
    const totalCurrCount = performanceData.reduce((sum, d) => sum + d.currCount, 0);
    const totalPrevRev = performanceData.reduce((sum, d) => sum + d.prevRev, 0);
    const totalCurrRev = performanceData.reduce((sum, d) => sum + d.currRev, 0);
    const totalPrevAccSet = new Set<string>();
    const totalCurrAccSet = new Set<string>();
    performanceData.forEach((d) => {
      d.prevAcc.forEach((id) => totalPrevAccSet.add(id));
      d.currAcc.forEach((id) => totalCurrAccSet.add(id));
    });

    // Format performance data for display (L / Cr, aligned with dashboard currency labels)
    const formatRevenue = (value: number): string => {
      if (value === 0) return "₹0";
      return formatCurrencyLabel(value);
    };

    const formatDiff = (curr: number, prev: number): string => {
      const diff = curr - prev;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    };

    const formatRevenueDiff = (
      curr: number,
      prev: number,
    ): { display: string; value: number } => {
      const diff = curr - prev;
      if (diff === 0) return { display: "₹0", value: 0 };
      const sign = diff > 0 ? "+" : "-";
      return {
        display: `${sign}${formatCurrencyLabel(Math.abs(diff))}`,
        value: diff,
      };
    };

    return [
      ...performanceData.map((d) => {
        const revDiff = formatRevenueDiff(d.currRev, d.prevRev);
        return {
          group: d.group,
          prevCount: d.prevCount,
          currCount: d.currCount,
          countDiff: formatDiff(d.currCount, d.prevCount),
          prevRev: formatRevenue(d.prevRev),
          currRev: formatRevenue(d.currRev),
          revDiff: revDiff.display,
          revDiffNumeric: revDiff.value,
          prevAcc: d.prevAcc.size,
          currAcc: d.currAcc.size,
          accDiff: formatDiff(d.currAcc.size, d.prevAcc.size),
        };
      }),
      (() => {
        const revDiff = formatRevenueDiff(totalCurrRev, totalPrevRev);
        return {
          group: "Total",
          prevCount: totalPrevCount,
          currCount: totalCurrCount,
          countDiff: formatDiff(totalCurrCount, totalPrevCount),
          prevRev: formatRevenue(totalPrevRev),
          currRev: formatRevenue(totalCurrRev),
          revDiff: revDiff.display,
          revDiffNumeric: revDiff.value,
          prevAcc: totalPrevAccSet.size,
          currAcc: totalCurrAccSet.size,
          accDiff: formatDiff(totalCurrAccSet.size, totalPrevAccSet.size),
        };
      })(),
    ];
  }, [
    rawAllMandates,
    accountMcvTierMapState,
    upsellMcvTierFilter,
    upsellDateContext.perfPrevMonthEnd,
    upsellDateContext.perfCurrMonthEnd,
  ]);

  // Update state when processed data changes
  useEffect(() => {
    setUpsellGroupB(processedUpsellGroupB);
    setUpsellGroupC(processedUpsellGroupC);
    setUpsellPerformance(processedUpsellPerformance);
  }, [processedUpsellGroupB, processedUpsellGroupC, processedUpsellPerformance]);

  // Helper function to apply target type filter to a Supabase query
  // Note: For each month/year combination, there can be maximum 2 targets:
  // 1 with target_type = 'existing' and 1 with target_type = 'new_cross_sell'
  const applyTargetTypeFilter = (query: any, statusFilter: string): any => {
    if (statusFilter === "Existing") {
      return query.eq("target_type", "existing");
    } else if (statusFilter === "All Cross Sell") {
      return query.eq("target_type", "new_cross_sell");
    } else if (statusFilter === "All Cross Sell + Existing") {
      // For "All Cross Sell + Existing", include both target types
      return query.in("target_type", ["existing", "new_cross_sell"]);
    } else if (statusFilter === "New Acquisitions") {
      // For "New Acquisitions", there are no targets, return query that will return no results
      return query.eq("target_type", "nonexistent"); // This will ensure no targets are returned
    }
    // For other statuses, don't filter by target_type (show all targets)
    return query;
  };


  const fetchKams = async () => {
    try {
      if (!selectedTeam) return;
      let query: any = supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "kam")
        .eq("test_account", false)
        .not("full_name", "is", null)
        .order("full_name", { ascending: true });
      if (selectedTeam !== "all") {
        query = query.eq("team", selectedTeam);
      }
      const { data, error } = await query;

      if (error) {
        console.error("Error fetching KAMs:", error);
        console.error("Error details:", error.message, error.code);
        return;
      }

      console.log("Fetched KAMs:", data?.length || 0, data);
      if (data) {
        setKams(data.filter((kam) => kam.full_name));
      }
    } catch (error) {
      console.error("Error fetching KAMs:", error);
    }
  };

  const fetchNsos = async () => {
    try {
      if (!selectedTeam) return;
      let query: any = supabase
        .from("profiles")
        .select("email, full_name")
        .eq("role", "nso")
        .eq("test_account", false)
        .order("full_name", { ascending: true, nullsFirst: false });
      if (selectedTeam !== "all") {
        query = query.eq("team", selectedTeam);
      }
      const { data, error } = await query;

      if (error) {
        console.error("Error fetching NSOs:", error);
        return;
      }

      if (data) {
        setNsos(
          data.map((p) => {
            const name = p.full_name?.trim() || "";
            const parts = name.split(/\s+/).filter(Boolean);
            return {
              mail_id: p.email,
              first_name: parts[0] || p.email,
              last_name: parts.slice(1).join(" "),
            };
          })
        );
      }
    } catch (error) {
      console.error("Error fetching NSOs:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      if (!selectedTeam) {
        // Wait until auth profile team is available.
        return;
      }
      const applyTeamFilter = (query: any): any => {
        if (!selectedTeam || selectedTeam === "all") return query;
        return query.eq("team", selectedTeam);
      };

      const testExclusions = await fetchTestProfileExclusions(supabase);
      testExclusionsRef.current = testExclusions;
      const withExcludedTestKams = (query: any, column = "kam_id") =>
        applyExcludeTestKamFilter(query, testExclusions.kamIds, column);
      const withoutTestProfileRows = <
        T extends { kam_id?: string | null; new_sales_owner?: string | null },
      >(
        rows: T[] | null | undefined,
      ) => filterRowsByTestProfiles(rows, testExclusions);
      
      // Get financial year date range from filter
      const fyDateRange = getFinancialYearDateRange(filterFinancialYear);
      const fyStartYear = fyDateRange.start.getFullYear();
      const fyEndYear = fyDateRange.end.getFullYear();
      
      // Convert FY filter to financial_year format used in monthly_targets (e.g., "FY25" -> "2025-26", "FY26" -> "2026-27")
      // FY format: FY25 means financial year 2025-26 (April 2025 to March 2026)
      const fyYearMatch = filterFinancialYear.match(/FY(\d{2})/);
      const financialYearString = fyYearMatch 
        ? (() => {
            const startYear = 2000 + parseInt(fyYearMatch[1], 10);
            const endYearDigits = String(parseInt(fyYearMatch[1], 10) + 1).padStart(2, '0');
            return `${startYear}-${endYearDigits}`;
          })()
        : null;

      const fyMonthsList = getFinancialYearMonths(filterFinancialYear);
      const scopedMonthPair =
        filterDashboardMonth !== "all"
          ? fyMonthsList.find((m) => m.key === filterDashboardMonth) ?? null
          : null;
      const isMonthScoped = scopedMonthPair !== null;

      const mandateDateRangeStart = isMonthScoped
        ? new Date(scopedMonthPair!.year, scopedMonthPair!.month - 1, 1)
        : fyDateRange.start;
      const mandateDateRangeEnd = isMonthScoped
        ? new Date(scopedMonthPair!.year, scopedMonthPair!.month, 0, 23, 59, 59, 999)
        : fyDateRange.end;

      const includeInDashboardPeriod = (
        monthDate: Date,
        monthYearKey: string
      ): boolean => {
        if (isMonthScoped && scopedMonthPair) {
          return monthYearKey === scopedMonthPair.key;
        }
        return monthDate >= fyDateRange.start && monthDate <= fyDateRange.end;
      };

      /** Full selected FY window (annual rollups; quarter achieved when month filter is on). */
      const monthInSelectedFY = (monthDate: Date): boolean =>
        monthDate >= fyDateRange.start && monthDate <= fyDateRange.end;

      /** Include inactive mandates in achieved rollups when they have MCV data in scope. */
      const hasAchievedMcvForRollupInclusion = (
        monthlyData: unknown,
      ): boolean => {
        if (isMonthScoped && scopedMonthPair) {
          return (
            getAchievedMcvForMonthKey(monthlyData, scopedMonthPair.key) > 0
          );
        }
        return hasAchievedMcvInPeriod(monthlyData, (monthDate) =>
          monthInSelectedFY(monthDate),
        );
      };

      const now = new Date();
      const calendarMonth = now.getMonth() + 1;
      const calendarYear = now.getFullYear();
      const refMonth = isMonthScoped ? scopedMonthPair!.month : calendarMonth;
      const refYear = isMonthScoped ? scopedMonthPair!.year : calendarYear;
      const currentMonthYear = `${refYear}-${String(refMonth).padStart(2, "0")}`;
      const quarterMonthYearPairs = getFYQuarterMonthYearPairs(refMonth, refYear);

      const startOfMonth = new Date(refYear, refMonth - 1, 1);
      const endOfMonth = new Date(refYear, refMonth, 0, 23, 59, 59, 999);
      const prevCalendarMonth = refMonth === 1 ? 12 : refMonth - 1;
      const prevCalendarYear = refMonth === 1 ? refYear - 1 : refYear;
      const prevMonthStart = new Date(prevCalendarYear, prevCalendarMonth - 1, 1);
      const prevMonthEnd = new Date(prevCalendarYear, prevCalendarMonth, 0, 23, 59, 59, 999);
      const prevMonthYearStr = `${prevCalendarYear}-${String(prevCalendarMonth).padStart(2, "0")}`;

      const { data: inactiveLifecycleRows } = await applyLobFilter(
        withExcludedTestKams(
          applyTeamFilter(
            supabase
              .from("mandates")
              .select("id, monthly_data")
              .eq("lifecycle_status", "Inactive"),
          ),
        ),
      );
      inactiveMandateIdsRef.current = buildInactiveMandateIdsForTargets(
        inactiveLifecycleRows,
        hasAchievedMcvForRollupInclusion,
      );

      /**
       * Mandates card (x / y):
       * - Full FY: active as-of end of FY (lifecycle log replay).
       * - Month filter: same scoped rows as total (y), but x only counts mandates with
       *   achieved MCV stored in monthly_data for the selected month.
       * Total (y) = mandates in scope with created_at <= period end when month-scoped.
       */
      const mandatesCardAsOf = isMonthScoped ? mandateDateRangeEnd : fyDateRange.end;

      let mandatesCardQuery = applyTeamFilter(
        supabase
          .from("mandates")
          .select(
            "id, lob, account_id, created_at, lifecycle_status, lifecycle_status_log, monthly_data",
          )
      );
      // Month filter: point-in-time total only includes mandates created on/before period end.
      if (isMonthScoped) {
        mandatesCardQuery = mandatesCardQuery.lte(
          "created_at",
          mandatesCardAsOf.toISOString()
        );
      }
      mandatesCardQuery = applyStatusFilter(
        mandatesCardQuery,
        filterUpsellStatus,
        isNsoFilterActive(filterNso)
      );
      mandatesCardQuery = applyKamFilter(mandatesCardQuery, filterKam, filterNso);
      mandatesCardQuery = applyLobFilter(mandatesCardQuery);
      mandatesCardQuery = withExcludedTestKams(mandatesCardQuery);

      const { data: mandatesForCard, error: mandatesCardError } =
        await mandatesCardQuery;

      if (mandatesCardError) throw mandatesCardError;

      const rows = withoutTestProfileRows(mandatesForCard || []);
      const allMandatesTotalCount = rows.length;
      const isActiveAsOf = (
        m: {
          lifecycle_status?: string | null;
          created_at?: string | null;
          lifecycle_status_log?: unknown;
        },
        asOf: Date,
      ) =>
        m.lifecycle_status === "Active" ||
        isMandateActiveAsOf(m.created_at, m.lifecycle_status_log, asOf);

      const isActiveMandateRow = (m: {
        lifecycle_status?: string | null;
        created_at?: string | null;
        lifecycle_status_log?: unknown;
      }) => isActiveAsOf(m, mandatesCardAsOf);

      const isActiveMandateForCard = (m: {
        lifecycle_status?: string | null;
        created_at?: string | null;
        lifecycle_status_log?: unknown;
        monthly_data?: unknown;
      }) => {
        if (isMonthScoped && scopedMonthPair) {
          return (
            getAchievedMcvForMonthKey(m.monthly_data, scopedMonthPair.key) > 0
          );
        }
        return isActiveMandateRow(m);
      };

      const activeMandatesCardCount = rows.filter((m: any) =>
        isActiveMandateForCard(m),
      ).length;

      const activeAccountIds = new Set<string>();
      rows.forEach((m: any) => {
        if (isActiveMandateForCard(m) && m.account_id) {
          activeAccountIds.add(m.account_id);
        }
      });
      const accountsWithActiveMandatesCount = activeAccountIds.size;

      const mandatesPerLobCounts: Record<string, number> = {};
      chartLobOptions.forEach((l) => {
        mandatesPerLobCounts[l] = 0;
      });
      rows.forEach((m: any) => {
        if (!isActiveMandateForCard(m)) {
          return;
        }
        const raw = (m.lob && String(m.lob).trim()) || "";
        const key = resolveDashboardChartLobKey(raw, chartLobOptions);
        if (!key) return;
        mandatesPerLobCounts[key] = (mandatesPerLobCounts[key] ?? 0) + 1;
      });
      const mandatesPerLobFormatted = chartLobOptions
        .map((lob) => ({
          lob,
          count: mandatesPerLobCounts[lob] ?? 0,
        }))
        .filter(
          (row) =>
            selectedLobs.length === 0 || selectedLobs.includes(row.lob)
        );
      setMandatesPerLobChart(
        activeMandatesCardCount === 0 ? [] : mandatesPerLobFormatted
      );

      /** Mandates counted active on the mandates card (same filters as x / overlap). */
      const activeMandateIdsFromCard = rows
        .filter((m: any) => isActiveMandateForCard(m))
        .map((m: any) => m.id)
        .filter(Boolean) as string[];

      // Fetch mandates created this month
      let monthCountQuery = applyTeamFilter(
        supabase
        .from("mandates")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString())
      );
      
      // Apply KAM/NSO filter
      monthCountQuery = applyKamFilter(monthCountQuery, filterKam, filterNso);
      monthCountQuery = applyLobFilter(monthCountQuery);
      monthCountQuery = withExcludedTestKams(monthCountQuery);
      
      const { count: monthCount, error: monthError } = await monthCountQuery;

      if (monthError) throw monthError;

      // Unique accounts from mandates in scope (status/KAM filters), not limited by financial year
      let accountsQuery = applyTeamFilter(
        supabase
        .from("mandates")
        .select("account_id")
      );
      
      // Apply status filter
      accountsQuery = applyStatusFilter(accountsQuery, filterUpsellStatus, isNsoFilterActive(filterNso));
      
      // Apply KAM/NSO filter
      accountsQuery = applyKamFilter(accountsQuery, filterKam, filterNso);
      accountsQuery = applyLobFilter(accountsQuery);
      accountsQuery = withExcludedTestKams(accountsQuery);
      
      accountsQuery = accountsQuery.not("account_id", "is", null);
      
      const { data: mandatesForAccounts, error: accountsError } = await accountsQuery;

      if (accountsError) throw accountsError;

      // Get unique account IDs
      const uniqueAccountIds = new Set<string>();
      if (mandatesForAccounts) {
        mandatesForAccounts.forEach((mandate: any) => {
          if (mandate.account_id) {
            uniqueAccountIds.add(mandate.account_id);
          }
        });
      }
      
      const accountsCount = uniqueAccountIds.size;

      // Fetch mandates with awign_share_percent to calculate average
      let mandatesDataQuery = applyTeamFilter(
        supabase
        .from("mandates")
        .select("awign_share_percent")
        .not("awign_share_percent", "is", null)
      );
      
      // Apply KAM/NSO filter
      mandatesDataQuery = applyKamFilter(mandatesDataQuery, filterKam, filterNso);
      mandatesDataQuery = applyLobFilter(mandatesDataQuery);
      mandatesDataQuery = withExcludedTestKams(mandatesDataQuery);
      
      const { data: mandatesData, error: mandatesDataError } = await mandatesDataQuery;

      if (mandatesDataError) throw mandatesDataError;

      // Calculate average Awign share
      // "Below 70%" = 35% (midpoint of 0-69%)
      // "70% & Above" = 85% (midpoint of 70-100%)
      let totalShare = 0;
      let count = 0;
      
      if (mandatesData && mandatesData.length > 0) {
        mandatesData.forEach((mandate) => {
          if (mandate.awign_share_percent) {
            if (mandate.awign_share_percent === "Below 70%") {
              totalShare += 35;
            } else if (mandate.awign_share_percent === "70% & Above") {
              totalShare += 85;
            }
            count++;
          }
        });
      }

      const average = count > 0 ? totalShare / count : null;

      // Calculate Overlap Factor (active mandates / accounts with at least one active mandate)
      const overlap =
        accountsWithActiveMandatesCount > 0
          ? activeMandatesCardCount / accountsWithActiveMandatesCount
          : null;

      // Update headline cards early so a later chart/tier failure cannot leave these at 0.
      setActiveMandatesCount(activeMandatesCardCount);
      setAllMandatesCount(allMandatesTotalCount || 0);
      setMandatesThisMonth(monthCount || 0);
      setTotalAccounts(accountsCount || 0);
      setAccountsWithActiveMandates(accountsWithActiveMandatesCount);
      setAvgAwignShare(average);
      setOverlapFactor(overlap);

      // Fetch all accounts with their MCV Tier once for filtering
      // This map will be used to filter mandates by MCV Tier
      const { data: allAccounts, error: allAccountsError } = await supabase
        .from("accounts")
        .select("id, mcv_tier");

      // Create a map of account_id to mcv_tier for efficient filtering
      // Initialize as empty object to prevent undefined errors
      const accountMcvTierMap: Record<string, string | null> = {};
      
      if (allAccountsError) {
        console.error("Error fetching accounts for MCV Tier filter:", allAccountsError);
      } else if (allAccounts) {
        allAccounts.forEach((account) => {
          if (account.id) {
            // Store the mcv_tier value (can be "Tier 1", "Tier 2", or null)
            // Store as-is, including null values
            accountMcvTierMap[account.id] = account.mcv_tier || null;
          }
        });
      }


      const upsellDates = getUpsellDateContext(
        filterFinancialYear,
        filterDashboardMonth,
        fyDateRange,
        fyMonthsList,
      );

      // Fetch mandates with retention_type = "B" for Group B upsell data (active-as-of filtered client-side)
      let groupBMandatesQuery = applyTeamFilter(
        supabase
          .from("mandates")
          .select(
            "upsell_action_status, revenue_mcv, account_id, created_at, lifecycle_status, lifecycle_status_log",
          )
          .eq("retention_type", "B")
      );

      groupBMandatesQuery = applyStatusFilter(groupBMandatesQuery, filterUpsellStatus, isNsoFilterActive(filterNso));
      groupBMandatesQuery = applyKamFilter(groupBMandatesQuery, filterKam, filterNso);
      groupBMandatesQuery = applyLobFilter(groupBMandatesQuery);
      groupBMandatesQuery = withExcludedTestKams(groupBMandatesQuery);
      groupBMandatesQuery = groupBMandatesQuery.lte(
        "created_at",
        upsellDates.maxCreatedAt.toISOString(),
      );
      
      const { data: groupBMandates, error: groupBError } = await groupBMandatesQuery;

      if (groupBError) throw groupBError;

      // Store raw data for client-side filtering
      setRawGroupBMandates(withoutTestProfileRows(groupBMandates || []));

      // Fetch mandates with retention_type = "C" for Group C upsell data (active-as-of filtered client-side)
      let groupCMandatesQuery = applyTeamFilter(
        supabase
          .from("mandates")
          .select(
            "upsell_action_status, revenue_mcv, account_id, created_at, lifecycle_status, lifecycle_status_log",
          )
          .eq("retention_type", "C")
      );

      groupCMandatesQuery = applyStatusFilter(groupCMandatesQuery, filterUpsellStatus, isNsoFilterActive(filterNso));
      groupCMandatesQuery = applyKamFilter(groupCMandatesQuery, filterKam, filterNso);
      groupCMandatesQuery = applyLobFilter(groupCMandatesQuery);
      groupCMandatesQuery = withExcludedTestKams(groupCMandatesQuery);
      groupCMandatesQuery = groupCMandatesQuery.lte(
        "created_at",
        upsellDates.maxCreatedAt.toISOString(),
      );
      
      const { data: groupCMandates, error: groupCError } = await groupCMandatesQuery;

      if (groupCError) throw groupCError;

      // Store raw data for client-side filtering
      setRawGroupCMandates(withoutTestProfileRows(groupCMandates || []));

      // Fetch mandates for upsell performance (active-as-of prev/curr month-end, client-side)
      let allMandatesQuery = applyTeamFilter(
        supabase
          .from("mandates")
          .select(
            "retention_type, revenue_mcv, account_id, created_at, lifecycle_status, lifecycle_status_log, type, kam_id",
          )
      );

      allMandatesQuery = applyStatusFilter(allMandatesQuery, filterUpsellStatus, isNsoFilterActive(filterNso));
      allMandatesQuery = applyKamFilter(allMandatesQuery, filterKam, filterNso);
      allMandatesQuery = applyLobFilter(allMandatesQuery);
      allMandatesQuery = withExcludedTestKams(allMandatesQuery);
      allMandatesQuery = allMandatesQuery.lte(
        "created_at",
        upsellDates.maxCreatedAt.toISOString(),
      );
      
      const { data: allMandates, error: allMandatesError } = await allMandatesQuery;

      if (allMandatesError) throw allMandatesError;

      // Store raw data for client-side filtering
      setRawAllMandates(withoutTestProfileRows(allMandates || []));
      setAccountMcvTierMapState(accountMcvTierMap || {});
      const scopedAccountIds = Array.from(
        new Set((allMandates || []).map((m: any) => m.account_id).filter(Boolean))
      );

      // Fetch LoB Sales / Max MCV only for mandates counted as active on the mandates card (as-of filters).
      let lobMandatesData: any[] = [];
      let lobMandatesError: any = null;
      if (activeMandateIdsFromCard.length > 0) {
        const ID_CHUNK = 120;
        const merged: any[] = [];
        for (let i = 0; i < activeMandateIdsFromCard.length; i += ID_CHUNK) {
          const idChunk = activeMandateIdsFromCard.slice(i, i + ID_CHUNK);
          let lobChunkQuery = applyTeamFilter(
            supabase
              .from("mandates")
              .select("id, lob, monthly_data, type, kam_id, account_id")
              .in("id", idChunk)
          );
          const { data: chunkData, error: chunkError } = await lobChunkQuery;
          if (chunkError) {
            lobMandatesError = chunkError;
            break;
          }
          merged.push(...(chunkData || []));
        }
        lobMandatesData = merged;
      }

      if (lobMandatesError) throw lobMandatesError;

      // Get mandate IDs for fetching targets
      const mandateIds = lobMandatesData?.map((m: any) => m.id).filter(Boolean) || [];

      // Fetch targets from monthly_targets table for these mandates
      // Target type depends on the filter:
      // - "Existing" → only existing targets
      // - "All Cross Sell" → only new_cross_sell targets
      // - "All Cross Sell + Existing" → both types
      // - "All mandate types" → both types
      // - "New Acquisitions" → no targets typically, but fetch anyway
      const fyMonthNumbers = isMonthScoped
        ? [scopedMonthPair!.month]
        : [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      const fyYears = isMonthScoped
        ? [scopedMonthPair!.year]
        : [fyDateRange.start.getFullYear(), fyDateRange.end.getFullYear()];
      // financialYearString is already declared earlier in the function, reuse it

      let targetsQuery = supabase
        .from("monthly_targets")
        .select("target, month, year, mandate_id, account_id, kam_id, target_type, mandates(lob, kam_id, type, account_id)")
        .in("month", fyMonthNumbers)
        .in("year", fyYears);
      
      if (financialYearString) {
        targetsQuery = targetsQuery.eq("financial_year", financialYearString);
      }
      if (selectedLobs.length > 0) {
        targetsQuery = targetsQuery.in(
          "mandates.lob",
          expandDashboardLobFilterValues(selectedLobs),
        );
      }
      
      // Apply target type filter based on mandate type filter
      if (filterUpsellStatus === "Existing") {
        targetsQuery = targetsQuery.eq("target_type", "existing");
        if (mandateIds.length > 0) {
          targetsQuery = targetsQuery.in("mandate_id", mandateIds);
        } else {
          targetsQuery = targetsQuery.eq("mandate_id", "00000000-0000-0000-0000-000000000000");
        }
      } else if (filterUpsellStatus === "All Cross Sell") {
        targetsQuery = targetsQuery.eq("target_type", "new_cross_sell");
        // For new_cross_sell, we need to match by KAM and account, not mandate_id
        // We'll filter client-side based on the mandates we have
      } else if (filterUpsellStatus === "All Cross Sell + Existing") {
        targetsQuery = targetsQuery.in("target_type", ["existing", "new_cross_sell"]);
        // For existing, filter by mandate_id; for new_cross_sell, filter client-side
      } else {
        // "All mandate types" or other - include both target types
        targetsQuery = targetsQuery.in("target_type", ["existing", "new_cross_sell"]);
      }
      targetsQuery = withExcludedTestKams(targetsQuery);

      const { data: targetsDataRaw, error: lobTargetsError } = await targetsQuery;
      const targetsData = filterTargetsByTestProfiles(
        targetsDataRaw,
        testExclusions,
      );

      // Initialize all LoBs from the mandate form with 0 values
      // Always show all 8 LoBs from the mandate form, regardless of database records
      const lobData: Record<string, { targetMpv: number; achievedMpv: number }> = {};
      chartLobOptions.forEach((lob) => {
        lobData[lob] = { targetMpv: 0, achievedMpv: 0 };
      });

      // Process targets from monthly_targets table
      if (!lobTargetsError && targetsData && targetsData.length > 0) {
        // Create a map of mandate IDs to their LoB for quick lookup
        const mandateLobMap: Record<string, string> = {};
        lobMandatesData?.forEach((m: any) => {
          if (m.id && m.lob) {
            const mapped = resolveDashboardChartLobKey(m.lob, chartLobOptions);
            if (mapped) mandateLobMap[m.id] = mapped;
          }
        });

        // Create a map of KAM+Account combinations to their mandates' LoBs
        // For new_cross_sell targets, we need to find which mandates match the KAM+account
        const kamAccountMandatesMap: Record<string, string[]> = {}; // "kamId_accountId" -> [lob1, lob2, ...]
        lobMandatesData?.forEach((m: any) => {
          if (m.kam_id && m.lob) {
            // For new_cross_sell, we need to match by account_id from mandates
            // But mandates don't directly have account_id in the query, so we'll use a different approach
            // Actually, for new_cross_sell targets, we need to get account_id from the target itself
          }
        });

        targetsData.forEach((target: any) => {
          if (
            target.mandate_id &&
            inactiveMandateIdsRef.current.has(target.mandate_id as string)
          ) {
            return;
          }
          const monthDate = new Date(target.year, target.month - 1, 1);
          if (
            !includeInDashboardPeriod(
              monthDate,
              `${target.year}-${String(target.month).padStart(2, "0")}`
            )
          ) {
            return;
          }

          const targetValue = parseFloat(target.target?.toString() || "0") || 0;
          if (targetValue <= 0) return;

          if (target.target_type === "existing" && target.mandate_id) {
            // Existing target: get LoB from mandate
            const mandate = Array.isArray(target.mandates) ? target.mandates[0] : target.mandates;
            const mappedLob = mandate?.lob
              ? resolveDashboardChartLobKey(mandate.lob, chartLobOptions)
              : null;
            if (mappedLob && lobData[mappedLob]) {
              lobData[mappedLob].targetMpv += targetValue;
            } else {
              // Fallback: use mandateLobMap
              const lob = mandateLobMap[target.mandate_id];
              if (lob && lobData[lob]) {
                lobData[lob].targetMpv += targetValue;
              }
            }
          } else if (target.target_type === "new_cross_sell" && target.kam_id && target.account_id) {
            // New cross sell target: find mandates with matching KAM and account_id
            const matchingMandates = lobMandatesData?.filter((m: any) => 
              m.kam_id === target.kam_id && m.account_id === target.account_id
            ) || [];
            
            if (matchingMandates.length > 0) {
              // Distribute target across matching mandates' LoBs
              // If multiple mandates with same LoB, sum them; if different LoBs, distribute evenly
              const lobCounts: Record<string, number> = {};
              matchingMandates.forEach((m: any) => {
                if (m.lob) {
                  const mapped = resolveDashboardChartLobKey(m.lob, chartLobOptions);
                  if (mapped) {
                    lobCounts[mapped] = (lobCounts[mapped] || 0) + 1;
                  }
                }
              });
              
              // Distribute target value evenly across unique LoBs
              const uniqueLobs = Object.keys(lobCounts);
              if (uniqueLobs.length > 0) {
                const valuePerLob = targetValue / uniqueLobs.length;
                uniqueLobs.forEach((lob) => {
                  if (lobData[lob]) {
                    lobData[lob].targetMpv += valuePerLob;
                  }
                });
              }
            }
          }
        });
      }

      // Process achieved values from monthly_data (new format: just a number, not an array)
      if (!lobMandatesError && lobMandatesData && lobMandatesData.length > 0) {
        lobMandatesData.forEach((mandate: any) => {
          const lob = resolveDashboardChartLobKey(mandate.lob, chartLobOptions);
          if (lob && lobData[lob]) {
            // monthly_data is a JSONB object where:
            // Key: month_year (format: "YYYY-MM", e.g., "2025-01")
            // Value: achievedMcv (number) - new format after migration
            const monthlyData = mandate.monthly_data;
            
            // Check if monthly_data exists and is an object
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              // Sum up all monthly records for this mandate within selected FY
              Object.entries(monthlyData).forEach(([monthYear, achievedMcv]: [string, any]) => {
                // New format: value is just a number (achieved MCV)
                // Old format (for backward compatibility): value is an array [plannedMcv, achievedMcv]
                let achievedValue = 0;
                
                if (Array.isArray(achievedMcv) && achievedMcv.length >= 2) {
                  // Old format: extract achieved MCV from array
                  achievedValue = parseFloat(achievedMcv[1]?.toString() || "0") || 0;
                } else if (typeof achievedMcv === 'number') {
                  // New format: value is directly the achieved MCV
                  achievedValue = parseFloat(achievedMcv.toString()) || 0;
                }
                
                if (achievedValue > 0) {
                  // Check if this month falls within the selected financial year
                  const [yearStr, monthStr] = monthYear.split('-');
                  const year = parseInt(yearStr);
                  const month = parseInt(monthStr);
                  const monthDate = new Date(year, month - 1, 1);
                  
                  // Only include if within selected FY date range
                  if (includeInDashboardPeriod(monthDate, monthYear)) {
                    lobData[lob].achievedMpv += achievedValue;
                  }
                }
              });
            }
          }
        });
      }

      // Convert to array with all 8 LoBs from the mandate form, maintaining the exact order
      const formattedLobData = chartLobOptions.map((lob) => ({
        lob,
        targetMpv: lobData[lob]?.targetMpv || 0,
        achievedMpv: lobData[lob]?.achievedMpv || 0,
      }))
      .filter((row) => selectedLobs.length === 0 || selectedLobs.includes(row.lob));

      // Debug: Log the calculated data to verify values
      console.log("LoB Sales Performance - Calculated Values:", formattedLobData);

      setLobSalesPerformance(activeMandatesCardCount === 0 ? [] : formattedLobData);

      const maxMcvByLob: Record<string, number> = {};
      chartLobOptions.forEach((l) => {
        maxMcvByLob[l] = 0;
      });
      if (!lobMandatesError && lobMandatesData && lobMandatesData.length > 0) {
        lobMandatesData.forEach((mandate: any) => {
          const lobRaw = (mandate.lob && String(mandate.lob).trim()) || "";
          const lobKey = resolveDashboardChartLobKey(lobRaw, chartLobOptions);
          if (!lobKey) return;
          const monthlyData = mandate.monthly_data;
          if (
            !monthlyData ||
            typeof monthlyData !== "object" ||
            Array.isArray(monthlyData)
          ) {
            return;
          }
          let maxAchievedForMandate = 0;
          Object.entries(monthlyData).forEach(([monthYear, record]) => {
            const parts = monthYear.split("-");
            if (parts.length < 2) return;
            const y = parseInt(parts[0], 10);
            const mo = parseInt(parts[1], 10);
            if (Number.isNaN(y) || Number.isNaN(mo)) return;
            const monthDate = new Date(y, mo - 1, 1);
            if (!includeInDashboardPeriod(monthDate, monthYear)) return;
            const achievedValue = getAchievedMcv(record);
            if (achievedValue > maxAchievedForMandate) {
              maxAchievedForMandate = achievedValue;
            }
          });
          maxMcvByLob[lobKey] =
            (maxMcvByLob[lobKey] ?? 0) + maxAchievedForMandate;
        });
      }
      const maxMcvPerLobFormatted = chartLobOptions
        .map((lob) => ({
          lob,
          sumMaxMcv: maxMcvByLob[lob] ?? 0,
        }))
        .filter(
          (row) =>
            selectedLobs.length === 0 || selectedLobs.includes(row.lob)
        );
      setMaxMcvPerLobChart(activeMandatesCardCount === 0 ? [] : maxMcvPerLobFormatted);

      // Fetch KAM Sales Performance data from mandates monthly records
      // Respect the mandate type filter from the top
      let kamMandatesQuery = applyTeamFilter(
        supabase
          .from("mandates")
          .select("id, kam_id, monthly_data, type, account_id, lifecycle_status"),
      );
      kamMandatesQuery = applyStatusFilter(kamMandatesQuery, filterUpsellStatus, isNsoFilterActive(filterNso));
      kamMandatesQuery = applyKamFilter(kamMandatesQuery, filterKam, filterNso);
      kamMandatesQuery = applyLobFilter(kamMandatesQuery);
      kamMandatesQuery = withExcludedTestKams(kamMandatesQuery);
      const { data: kamMandatesDataRaw, error: kamMandatesError } =
        await kamMandatesQuery;
      const kamMandatesData = filterMandatesForRollups(
        withoutTestProfileRows(kamMandatesDataRaw),
        hasAchievedMcvForRollupInclusion,
      );

      // Get mandate IDs for fetching targets
      const kamMandateIds = kamMandatesData?.map((m: any) => m.id).filter(Boolean) || [];

      // Fetch targets from monthly_targets table for these mandates
      // Target type depends on the filter (same logic as LoB section)
      let kamTargetsQuery = supabase
        .from("monthly_targets")
        .select(
          "target, month, year, mandate_id, account_id, kam_id, nso_mail_id, target_type, mandates(kam_id, type, new_sales_owner)"
        )
        .in("month", fyMonthNumbers)
        .in("year", fyYears);
      
      if (financialYearString) {
        kamTargetsQuery = kamTargetsQuery.eq("financial_year", financialYearString);
      }
      kamTargetsQuery = withExcludedTestKams(kamTargetsQuery);
      // Apply target type filter based on mandate type filter
      if (filterUpsellStatus === "Existing") {
        kamTargetsQuery = kamTargetsQuery.eq("target_type", "existing");
        // Filter by mandate_id to only get targets for mandates we care about
        if (kamMandateIds.length > 0) {
          kamTargetsQuery = kamTargetsQuery.in("mandate_id", kamMandateIds);
        } else {
          // If no mandates match, return empty result
          kamTargetsQuery = kamTargetsQuery.eq("mandate_id", "00000000-0000-0000-0000-000000000000");
        }
      } else if (filterUpsellStatus === "All Cross Sell") {
        kamTargetsQuery = kamTargetsQuery.eq("target_type", "new_cross_sell");
        // For new_cross_sell, filter by kam_id from the mandates we have
        const kamIdsFromMandates = [...new Set(kamMandatesData?.map((m: any) => m.kam_id).filter(Boolean) || [])];
        if (kamIdsFromMandates.length > 0) {
          kamTargetsQuery = kamTargetsQuery.in("kam_id", kamIdsFromMandates);
        } else {
          kamTargetsQuery = kamTargetsQuery.eq("kam_id", "00000000-0000-0000-0000-000000000000");
        }
      } else if (filterUpsellStatus === "All Cross Sell + Existing") {
        kamTargetsQuery = kamTargetsQuery.in("target_type", ["existing", "new_cross_sell"]);
      } else {
        // "All mandate types" or other - include both target types
        kamTargetsQuery = kamTargetsQuery.in("target_type", ["existing", "new_cross_sell"]);
      }

      const { data: kamTargetsData, error: kamTargetsError } = await kamTargetsQuery;
      
      console.log("KAM Targets Query Details:", {
        filter: filterUpsellStatus,
        mandateIdsCount: kamMandateIds.length,
        mandateIds: kamMandateIds.slice(0, 5), // First 5 for debugging
        financialYear: financialYearString,
        months: fyMonthNumbers,
        years: fyYears,
        targetsFetched: kamTargetsData?.length || 0,
        error: kamTargetsError
      });
      
      if (kamTargetsData && kamTargetsData.length > 0) {
        console.log("Sample KAM target:", kamTargetsData[0]);
      }

      console.log("KAM Targets Query - Filter:", filterUpsellStatus, "Mandate IDs:", kamMandateIds.length);
      console.log("KAM Targets Data:", kamTargetsData?.length || 0, "Error:", kamTargetsError);

      // Fetch all KAMs to get their names (only profiles with role = 'kam')
      let allKamsQuery: any = supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam")
        .eq("test_account", false)
        .not("full_name", "is", null)
        .order("full_name", { ascending: true });
      if (selectedTeam !== "all") {
        allKamsQuery = allKamsQuery.eq("team", selectedTeam);
      }
      const { data: allKamsData, error: allKamsError } = await allKamsQuery;

      // Create KAM map
      const kamMap: Record<string, string> = {};
      if (allKamsData) {
        allKamsData.forEach((kam: any) => {
          if (kam.full_name) {
            kamMap[kam.id] = kam.full_name;
          }
        });
      }

      // Initialize all KAMs with 0 values
      const kamData: Record<string, { targetMpv: number; achievedMpv: number }> = {};
      Object.keys(kamMap).forEach((kamId) => {
        kamData[kamId] = { targetMpv: 0, achievedMpv: 0 };
      });

      // Process targets from monthly_targets table
      if (!kamTargetsError && kamTargetsData && kamTargetsData.length > 0) {
        console.log("Processing KAM targets, count:", kamTargetsData.length);
        // Create a map of mandate IDs to their KAM for quick lookup
        const mandateKamMap: Record<string, string> = {};
        kamMandatesData?.forEach((m: any) => {
          if (m.id && m.kam_id) {
            mandateKamMap[m.id] = m.kam_id;
          }
        });
        
        console.log("Mandate-KAM Map created:", {
          totalMandates: kamMandatesData?.length || 0,
          mandatesWithKAM: Object.keys(mandateKamMap).length,
          sampleEntries: Object.entries(mandateKamMap).slice(0, 3)
        });

        kamTargetsData.forEach((target: any) => {
          if (
            target.mandate_id &&
            inactiveMandateIdsRef.current.has(target.mandate_id as string)
          ) {
            return;
          }
          const monthDate = new Date(target.year, target.month - 1, 1);
          if (
            !includeInDashboardPeriod(
              monthDate,
              `${target.year}-${String(target.month).padStart(2, "0")}`
            )
          ) {
            return;
          }

          const targetValue = parseFloat(target.target?.toString() || "0") || 0;
          if (targetValue <= 0) return;

          if (target.target_type === "existing" && target.mandate_id) {
            // Existing target: get KAM from mandate
            // First check if this mandate is in our filtered mandate list
            const mandateInList = kamMandateIds.includes(target.mandate_id);
            if (!mandateInList) {
              // Skip targets for mandates not in our filtered list
              return;
            }
            
            // Get KAM ID from our mandate map (we already fetched mandates with their KAM IDs)
            const kamId = mandateKamMap[target.mandate_id];
            
            if (!kamId) {
              console.warn("KAM target - No KAM found for mandate_id:", target.mandate_id, "target:", target);
              return;
            }
            
            if (kamData[kamId]) {
              kamData[kamId].targetMpv += targetValue;
              console.log(`Added target ${targetValue} to KAM ${kamId} (${kamMap[kamId]}) from mandate ${target.mandate_id}`);
            } else {
              console.warn("KAM target - KAM not in kamData:", kamId, "target:", target);
            }
          } else if (target.target_type === "new_cross_sell" && target.kam_id) {
            // New cross sell target: use kam_id directly from target
            // Also verify it matches a mandate we have (by matching account_id if available)
            if (target.account_id) {
              const matchingMandate = kamMandatesData?.find((m: any) => 
                m.kam_id === target.kam_id && m.account_id === target.account_id
              );
              if (matchingMandate && kamData[target.kam_id]) {
                kamData[target.kam_id].targetMpv += targetValue;
                console.log(`Added new_cross_sell target ${targetValue} to KAM ${target.kam_id} (${kamMap[target.kam_id]})`);
              } else {
                console.warn("KAM target - No matching mandate for new_cross_sell:", target);
              }
            } else {
              // If no account_id match required, just use kam_id
              if (kamData[target.kam_id]) {
                kamData[target.kam_id].targetMpv += targetValue;
                console.log(`Added new_cross_sell target ${targetValue} to KAM ${target.kam_id} (${kamMap[target.kam_id]}) - no account_id`);
              } else {
                console.warn("KAM target - KAM not in kamData for new_cross_sell:", target.kam_id, "target:", target);
              }
            }
          } else {
            console.warn("KAM target - Unknown target type or missing fields:", target);
          }
        });
        
        console.log("KAM Target Data after processing:", kamData);
      }

      // Process achieved values from monthly_data (new format: just a number, not an array)
      if (!kamMandatesError && kamMandatesData && kamMandatesData.length > 0) {
        kamMandatesData.forEach((mandate: any) => {
          const kamId = mandate.kam_id;
          if (kamId && kamData[kamId]) {
            const monthlyData = mandate.monthly_data;
            
            // Check if monthly_data exists and is an object
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              // Sum up all monthly records for this mandate within selected FY
              Object.entries(monthlyData).forEach(([monthYear, achievedMcv]: [string, any]) => {
                // New format: value is just a number (achieved MCV)
                // Old format (for backward compatibility): value is an array [plannedMcv, achievedMcv]
                let achievedValue = 0;
                
                if (Array.isArray(achievedMcv) && achievedMcv.length >= 2) {
                  // Old format: extract achieved MCV from array
                  achievedValue = parseFloat(achievedMcv[1]?.toString() || "0") || 0;
                } else if (typeof achievedMcv === 'number') {
                  // New format: value is directly the achieved MCV
                  achievedValue = parseFloat(achievedMcv.toString()) || 0;
                }
                
                if (achievedValue > 0) {
                  // Check if this month falls within the selected financial year
                  const [yearStr, monthStr] = monthYear.split('-');
                  const year = parseInt(yearStr);
                  const month = parseInt(monthStr);
                  const monthDate = new Date(year, month - 1, 1);
                  
                  // Only include if within selected FY date range
                  if (includeInDashboardPeriod(monthDate, monthYear)) {
                    kamData[kamId].achievedMpv += achievedValue;
                  }
                }
              });
            }
          }
        });
      }

      // Convert to array with all KAMs, sorted by name
      const formattedKamData = Object.keys(kamMap)
        .map((kamId) => ({
          kamId,
          kamName: kamMap[kamId],
          targetMpv: kamData[kamId]?.targetMpv || 0,
          achievedMpv: kamData[kamId]?.achievedMpv || 0,
        }))
        .sort((a, b) => a.kamName.localeCompare(b.kamName));

      setKamSalesPerformance(formattedKamData);

      let totalMcvPlanned = 0;
      let totalFfmAchieved = 0;

      const mandateTypeById: Record<string, string> = {};
      kamMandatesData?.forEach((m: any) => {
        if (m.id && m.type) {
          mandateTypeById[m.id] = m.type;
        }
      });

      const fyPairsForManager = getMonthYearPairsForFY(filterFinancialYear);
      const managerMonthKey = (m: number, y: number) =>
        `${y}-${String(m).padStart(2, "0")}`;
      const fyPairSet = new Set(
        fyPairsForManager.map((p) => managerMonthKey(p.month, p.year))
      );
      const quarterPairSet = new Set(
        quarterMonthYearPairs.map((p) => managerMonthKey(p.month, p.year))
      );

      let totalAnnualTarget = 0;
      let totalQuarterTarget = 0;
      let managerTargetsFyRows: ManagerTargetRow[] | null = null;

      if (hasPersonFilter()) {
        // KAM/NSO filter: sum mandate-level monthly_targets for the selected person(s)
        const inactive = inactiveMandateIdsRef.current;
        let cardTargets = filterTargetsByKamNso(kamTargetsData || []);
        cardTargets = filterMonthlyTargetsByUpsellStatus(
          cardTargets,
          filterUpsellStatus,
          mandateTypeById
        );

        totalMcvPlanned = sumMonthlyTargetValues(
          cardTargets,
          inactive,
          includeInDashboardPeriod
        );
        totalAnnualTarget = sumMonthlyTargetValues(
          cardTargets,
          inactive,
          (monthDate) => monthInSelectedFY(monthDate)
        );
        totalQuarterTarget = sumMonthlyTargetValues(
          cardTargets,
          inactive,
          (monthDate, monthYearKey) => {
            const [yearStr, monthStr] = monthYearKey.split("-");
            const monthNum = parseInt(monthStr, 10);
            const yearNum = parseInt(yearStr, 10);
            return (
              quarterMonthYearPairs.some(
                (p) => p.month === monthNum && p.year === yearNum
              ) && monthInSelectedFY(monthDate)
            );
          }
        );
      } else {
        // Org-level targets: one row per calendar month per team in manager_targets
        const { data } = await supabase
          .from("manager_targets")
          .select("month, year, existing_target, new_ac_target, team")
          .in("team", selectedTeam === "all" ? ["ce", "staffing", "experts"] : [selectedTeam])
          .in("year", [fyStartYear, fyEndYear]);

        managerTargetsFyRows = data ?? null;

        if (managerTargetsFyRows) {
          for (const row of managerTargetsFyRows) {
            const k = managerMonthKey(row.month, row.year);
            const existing = parseFloat(String(row.existing_target ?? 0)) || 0;
            const newAc = parseFloat(String(row.new_ac_target ?? 0)) || 0;
            const tv = managerTargetValueForMandateFilter(
              existing,
              newAc,
              filterUpsellStatus
            );
            if (fyPairSet.has(k)) {
              totalAnnualTarget += tv;
            }
            if (quarterPairSet.has(k)) {
              totalQuarterTarget += tv;
            }
          }
        }

        totalMcvPlanned = sumManagerTargetsForMonth(
          managerTargetsFyRows,
          refMonth,
          refYear,
          filterUpsellStatus
        );
      }

      // Target MCV card: top-level manager_targets unless KAM/NSO filter → upsell targets on active mandates
      let targetMcvCardPlanned = 0;

      if (isKamOrNsoTargetMcvFilterActive()) {
        let cardMandatesQuery = supabase
          .from("mandates")
          .select("id, lifecycle_status, monthly_data");
        cardMandatesQuery = applyKamFilter(cardMandatesQuery, filterKam, filterNso);
        cardMandatesQuery = withExcludedTestKams(cardMandatesQuery);

        const { data: cardMandatesRaw } = await cardMandatesQuery;
        const cardMandates = filterMandatesForRollups(
          withoutTestProfileRows(cardMandatesRaw),
          hasAchievedMcvForRollupInclusion,
        );
        const cardMandateIds =
          cardMandates.map((m: { id: string }) => m.id).filter(Boolean) || [];

        if (cardMandateIds.length > 0) {
          let cardTargetsQuery = supabase
            .from("monthly_targets")
            .select(
              "target, month, year, mandate_id, kam_id, nso_mail_id, target_type, mandates(kam_id, type, new_sales_owner)",
            )
            .eq("target_type", "existing")
            .in("mandate_id", cardMandateIds)
            .in("month", fyMonthNumbers)
            .in("year", fyYears);

          if (financialYearString) {
            cardTargetsQuery = cardTargetsQuery.eq("financial_year", financialYearString);
          }
          cardTargetsQuery = withExcludedTestKams(cardTargetsQuery);

          const { data: cardUpsellTargets } = await cardTargetsQuery;
          const inactive = inactiveMandateIdsRef.current;
          const upsellTargets = filterTargetsByKamNso(cardUpsellTargets || []);
          const targetMcvPeriodFilter = isMonthScoped
            ? includeInDashboardPeriod
            : (monthDate: Date) => monthInSelectedFY(monthDate);

          targetMcvCardPlanned = sumMonthlyTargetValues(
            upsellTargets,
            inactive,
            targetMcvPeriodFilter,
          );
        }
      } else {
        if (!managerTargetsFyRows) {
          const { data } = await supabase
            .from("manager_targets")
            .select("month, year, existing_target, new_ac_target, team")
            .in("team", selectedTeam === "all" ? ["ce", "staffing", "experts"] : [selectedTeam])
            .in("year", [fyStartYear, fyEndYear]);
          managerTargetsFyRows = data ?? null;
        }

        if (isMonthScoped) {
          targetMcvCardPlanned = sumManagerTargetsForMonth(
            managerTargetsFyRows,
            refMonth,
            refYear,
            filterUpsellStatus,
          );
        } else if (managerTargetsFyRows) {
          for (const row of managerTargetsFyRows) {
            const k = managerMonthKey(row.month, row.year);
            if (!fyPairSet.has(k)) continue;
            const existing = parseFloat(String(row.existing_target ?? 0)) || 0;
            const newAc = parseFloat(String(row.new_ac_target ?? 0)) || 0;
            targetMcvCardPlanned += managerTargetValueForMandateFilter(
              existing,
              newAc,
              filterUpsellStatus,
            );
          }
        }
      }

      // Fetch all mandates with monthly_data to calculate FFM Achieved for current month within selected FY
      // Apply status filter based on filterUpsellStatus
      let mandatesQuery = applyTeamFilter(
        supabase
          .from("mandates")
          .select("monthly_data, type, new_sales_owner, lifecycle_status"),
      );
      mandatesQuery = applyStatusFilter(mandatesQuery, filterUpsellStatus, isNsoFilterActive(filterNso));
      mandatesQuery = applyKamFilter(mandatesQuery, filterKam, filterNso);
      mandatesQuery = applyLobFilter(mandatesQuery);
      mandatesQuery = withExcludedTestKams(mandatesQuery);
      const { data: allMandatesForMcvRaw, error: mcvError } = await mandatesQuery;
      const allMandatesForMcv = filterMandatesForRollups(
        withoutTestProfileRows(allMandatesForMcvRaw),
        hasAchievedMcvForRollupInclusion,
      );
      
      // Debug logging for NSO filter
      if (isNsoFilterActive(filterNso)) {
        console.log(`NSO Filter - Mandates Query: filterNso=${filterNso}, mandates found: ${allMandatesForMcv?.length || 0}`);
        if (allMandatesForMcv && allMandatesForMcv.length > 0) {
          console.log(`NSO Filter - Sample mandates:`, allMandatesForMcv.slice(0, 3).map(m => ({ 
            type: m.type, 
            new_sales_owner: m.new_sales_owner 
          })));
        }
      }

      // If filtering by NSO or all NSOs, process New Acquisition mandates
      if (isNsoFilterActive(filterNso)) {
        // For NSO filter, only process New Acquisition mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Acquisition' (should always be true when filtering by NSO)
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                    // Check if this month falls within the selected financial year
                    const [yearStr, monthStr] = monthYear.split('-');
                    const year = parseInt(yearStr);
                    const month = parseInt(monthStr);
                    const monthDate = new Date(year, month - 1, 1);
                    
                    // includeInDashboardPeriod handles both month-scoped and full-FY modes
                    if (includeInDashboardPeriod(monthDate, monthYear)) {
                      const achievedMcv = getAchievedMcv(monthRecord);
                      totalFfmAchieved += achievedMcv;
                    }
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell") {
        // For "All Cross Sell", calculate from mandates with type = 'New Cross Sell'
        // Only count achieved MCV for current month that falls within selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Cross Sell'
            if (mandate.type === "New Cross Sell") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    // Check if this month falls within the selected financial year
                    const [yearStr, monthStr] = monthYear.split('-');
                    const year = parseInt(yearStr);
                    const month = parseInt(monthStr);
                    const monthDate = new Date(year, month - 1, 1);
                    
                    // includeInDashboardPeriod handles both month-scoped and full-FY modes
                    if (includeInDashboardPeriod(monthDate, monthYear)) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                      totalFfmAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "Existing") {
        // For "Existing" status, calculate from mandates with type = 'Existing'
        // Only count achieved MCV for current month that falls within selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'Existing'
            if (mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    // Check if this month falls within the selected financial year
                    const [yearStr, monthStr] = monthYear.split('-');
                    const year = parseInt(yearStr);
                    const month = parseInt(monthStr);
                    const monthDate = new Date(year, month - 1, 1);
                    
                    // includeInDashboardPeriod handles both month-scoped and full-FY modes
                    if (includeInDashboardPeriod(monthDate, monthYear)) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                      totalFfmAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell + Existing") {
        // For "All Cross Sell + Existing", calculate from mandates with type = 'New Cross Sell' OR 'Existing'
        // Only count achieved MCV for current month that falls within selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Include mandates with type = 'New Cross Sell' or 'Existing'
            if (mandate.type === "New Cross Sell" || mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    // Check if this month falls within the selected financial year
                    const [yearStr, monthStr] = monthYear.split('-');
                    const year = parseInt(yearStr);
                    const month = parseInt(monthStr);
                    const monthDate = new Date(year, month - 1, 1);
                    
                    // includeInDashboardPeriod handles both month-scoped and full-FY modes
                    if (includeInDashboardPeriod(monthDate, monthYear)) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                      totalFfmAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "New Acquisitions") {
        // For "New Acquisitions", calculate from mandates with type = 'New Acquisition'
        // Only count achieved MCV for current month that falls within selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Acquisition'
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    // Check if this month falls within the selected financial year
                    const [yearStr, monthStr] = monthYear.split('-');
                    const year = parseInt(yearStr);
                    const month = parseInt(monthStr);
                    const monthDate = new Date(year, month - 1, 1);
                    
                    // includeInDashboardPeriod handles both month-scoped and full-FY modes
                    if (includeInDashboardPeriod(monthDate, monthYear)) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                      totalFfmAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else {
        // For other statuses, use mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            const monthlyData = mandate.monthly_data;
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                // Check if this month falls within the selected dashboard period
                const [yearStr, monthStr] = monthYear.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr);
                const monthDate = new Date(year, month - 1, 1);
                if (includeInDashboardPeriod(monthDate, monthYear)) {
                  totalFfmAchieved += getAchievedMcv(monthRecord);
                }
              });
            }
          });
        }
      }

      // Calculate FFM Achieved percentage: (FFM Achieved / Target MCV card) * 100
      const ffmPercentage =
        targetMcvCardPlanned > 0
          ? (totalFfmAchieved / targetMcvCardPlanned) * 100
          : 0;

      // MCV This Quarter: full FY quarter containing ref (quarterMonthYearPairs set above)
      let totalMcvThisQuarter = 0;

      // Calculate sum of achieved MCV for current quarter months
      // If filtering by NSO or all NSOs, process New Acquisition mandates
      if (isNsoFilterActive(filterNso)) {
        // For NSO filter, only process New Acquisition mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Acquisition' (should always be true when filtering by NSO)
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  const [year, month] = monthYear.split('-');
                  const yearNum = parseInt(year);
                  const monthNum = parseInt(month);
                  const achievedMcv = getAchievedMcv(monthRecord);
                  
                  // Check if this month belongs to the current quarter and selected FY
                  const monthDate = new Date(yearNum, monthNum - 1, 1);
                  if (
                    quarterMonthYearPairs.some(
                      (p) => p.month === monthNum && p.year === yearNum
                    ) &&
                    monthInSelectedFY(monthDate)
                  ) {
                    totalMcvThisQuarter += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell") {
        // For "All Cross Sell", calculate from mandates with type = 'New Cross Sell'
        // Only count achieved MCV for months that belong to current quarter and selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Cross Sell'
            if (mandate.type === "New Cross Sell") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                  const achievedMcv = getAchievedMcv(monthRecord);
                    
                    // Check if this month belongs to the current quarter and selected FY
                    const monthDate = new Date(yearNum, monthNum - 1, 1);
                    if (
                      quarterMonthYearPairs.some(
                        (p) => p.month === monthNum && p.year === yearNum
                      ) &&
                      monthInSelectedFY(monthDate)
                    ) {
                      totalMcvThisQuarter += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "Existing") {
        // For "Existing" status, calculate from mandates with type = 'Existing'
        // Only count achieved MCV for months that belong to current quarter and selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'Existing'
            if (mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                  const achievedMcv = getAchievedMcv(monthRecord);
                    
                    // Check if this month belongs to the current quarter and selected FY
                    const monthDate = new Date(yearNum, monthNum - 1, 1);
                    if (
                      quarterMonthYearPairs.some(
                        (p) => p.month === monthNum && p.year === yearNum
                      ) &&
                      monthInSelectedFY(monthDate)
                    ) {
                      totalMcvThisQuarter += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell + Existing") {
        // For "All Cross Sell + Existing", calculate from mandates with type = 'New Cross Sell' OR 'Existing'
        // Only count achieved MCV for months that belong to current quarter and selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Include mandates with type = 'New Cross Sell' or 'Existing'
            if (mandate.type === "New Cross Sell" || mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                  const achievedMcv = getAchievedMcv(monthRecord);
                    
                    // Check if this month belongs to the current quarter and selected FY
                    const monthDate = new Date(yearNum, monthNum - 1, 1);
                    if (
                      quarterMonthYearPairs.some(
                        (p) => p.month === monthNum && p.year === yearNum
                      ) &&
                      monthInSelectedFY(monthDate)
                    ) {
                      totalMcvThisQuarter += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "New Acquisitions") {
        // For "New Acquisitions", calculate from mandates with type = 'New Acquisition'
        // Only count achieved MCV for months that belong to current quarter and selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Acquisition'
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                  const achievedMcv = getAchievedMcv(monthRecord);
                    
                    // Check if this month belongs to the current quarter and selected FY
                    const monthDate = new Date(yearNum, monthNum - 1, 1);
                    if (
                      quarterMonthYearPairs.some(
                        (p) => p.month === monthNum && p.year === yearNum
                      ) &&
                      monthInSelectedFY(monthDate)
                    ) {
                      totalMcvThisQuarter += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else {
        // For other statuses (including "All mandate types"), use all mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            const monthlyData = mandate.monthly_data;
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                const [year, month] = monthYear.split('-');
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                const achievedMcv = getAchievedMcv(monthRecord);
                
                // Check if this month belongs to the current quarter and selected FY
                const monthDate = new Date(yearNum, monthNum - 1, 1);
                if (
                  quarterMonthYearPairs.some(
                    (p) => p.month === monthNum && p.year === yearNum
                  ) &&
                  monthInSelectedFY(monthDate)
                ) {
                  totalMcvThisQuarter += achievedMcv;
                }
              });
            }
          });
        }
      }

      setMcvPlanned(targetMcvCardPlanned);
      setFfmAchieved(totalFfmAchieved);
      setFfmAchievedFyPercentage(ffmPercentage);
      setMcvThisQuarter(totalMcvThisQuarter);

      // Calculate MCV Achieved Last Month (calendar month before reference month)
      let totalMcvLastMonth = 0;

      // Calculate sum of achieved MCV for previous month using the same filter logic
      // If filtering by NSO or all NSOs, process New Acquisition mandates
      if (isNsoFilterActive(filterNso)) {
        // For NSO filter, only process New Acquisition mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (monthYear === prevMonthYearStr) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                    const monthDate = new Date(prevCalendarYear, prevCalendarMonth - 1, 1);
                    if (monthInSelectedFY(monthDate)) {
                      totalMcvLastMonth += achievedMcv;
                    }
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell") {
        // For "All Cross Sell", calculate from mandates with type = 'New Cross Sell'
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            if (mandate.type === "New Cross Sell") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (monthYear === prevMonthYearStr) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                    const monthDate = new Date(prevCalendarYear, prevCalendarMonth - 1, 1);
                    if (monthInSelectedFY(monthDate)) {
                      totalMcvLastMonth += achievedMcv;
                    }
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "Existing") {
        // For "Existing" status, calculate from mandates with type = 'Existing'
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            if (mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (monthYear === prevMonthYearStr) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                    const monthDate = new Date(prevCalendarYear, prevCalendarMonth - 1, 1);
                    if (monthInSelectedFY(monthDate)) {
                      totalMcvLastMonth += achievedMcv;
                    }
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell + Existing") {
        // For "All Cross Sell + Existing", calculate from mandates with type = 'New Cross Sell' OR 'Existing'
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            if (mandate.type === "New Cross Sell" || mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (monthYear === prevMonthYearStr) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                    const monthDate = new Date(prevCalendarYear, prevCalendarMonth - 1, 1);
                    if (monthInSelectedFY(monthDate)) {
                      totalMcvLastMonth += achievedMcv;
                    }
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "New Acquisitions") {
        // For "New Acquisitions", calculate from mandates with type = 'New Acquisition'
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (monthYear === prevMonthYearStr) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                    const monthDate = new Date(prevCalendarYear, prevCalendarMonth - 1, 1);
                    if (monthInSelectedFY(monthDate)) {
                      totalMcvLastMonth += achievedMcv;
                    }
                  }
                });
              }
            }
          });
        }
      } else {
        // For other statuses (including "All mandate types"), use all mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            const monthlyData = mandate.monthly_data;
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                if (monthYear === prevMonthYearStr) {
                  const achievedMcv = getAchievedMcv(monthRecord);
                  const monthDate = new Date(prevCalendarYear, prevCalendarMonth - 1, 1);
                  if (monthInSelectedFY(monthDate)) {
                    totalMcvLastMonth += achievedMcv;
                  }
                }
              });
            }
          });
        }
      }

      setMcvLastMonth(totalMcvLastMonth);

      // Calculate Target MCV Next Quarter
      const nextQuarterMonthYearPairs = getNextFYQuarterMonthYearPairs(refMonth, refYear);
      const nextQuarterMonths = nextQuarterMonthYearPairs.map((p) => p.month);
      const nextQuarterYear = nextQuarterMonthYearPairs[0].year;

      // Fetch targets for next quarter months within selected FY
      let nextQuarterQuery = supabase
        .from("monthly_targets")
        .select("target, kam_id, mandate_id, nso_mail_id, target_type, mandates(kam_id, type, new_sales_owner)")
        .in("month", nextQuarterMonths)
        .eq("year", nextQuarterYear);
      
      // Filter by financial_year if available
      if (financialYearString) {
        nextQuarterQuery = nextQuarterQuery.eq("financial_year", financialYearString);
      }
      if (selectedTeam !== "all") {
        nextQuarterQuery = nextQuarterQuery.eq("mandates.team", selectedTeam);
      }
      if (selectedLobs.length > 0) {
        nextQuarterQuery = nextQuarterQuery.in(
          "mandates.lob",
          expandDashboardLobFilterValues(selectedLobs),
        );
      }
      nextQuarterQuery = withExcludedTestKams(nextQuarterQuery);
      
      // Don't apply target_type filter - we'll filter by mandate type client-side
      const { data: allNextQuarterTargets, error: nextQuarterTargetsError } = await nextQuarterQuery;

      // Apply KAM/NSO filter client-side to handle both direct kam_id and via mandate
      let nextQuarterTargets = filterTargetsByKamNso(allNextQuarterTargets || []);

      // Filter by mandate type based on filterUpsellStatus
      // Only include targets that are linked to mandates (target_type = 'existing' with mandate_id)
      if (nextQuarterTargets && nextQuarterTargets.length > 0) {
        nextQuarterTargets = nextQuarterTargets.filter((target: any) => {
          // Only include targets linked to mandates
          if (target.target_type !== 'existing' || !target.mandate_id) {
            return false;
          }
          
          // Get mandate object (handle both array and single object)
          const mandate = Array.isArray(target.mandates) ? target.mandates[0] : target.mandates;
          if (!mandate) {
            return false;
          }
          
          const mandateType = mandate.type;
          
          // Filter by mandate type based on filterUpsellStatus
          if (filterUpsellStatus === "Existing") {
            return mandateType === 'Existing';
          } else if (filterUpsellStatus === "All Cross Sell") {
            return mandateType === 'New Cross Sell';
          } else if (filterUpsellStatus === "All Cross Sell + Existing") {
            return mandateType === 'Existing' || mandateType === 'New Cross Sell';
          } else if (filterUpsellStatus === "New Acquisitions") {
            return mandateType === 'New Acquisition';
          } else {
            // For "All mandate types" or other status filters, include all targets linked to mandates
            return true;
          }
        });
      }

      let totalTargetNextQuarter = 0;
      if (!nextQuarterTargetsError && nextQuarterTargets) {
        totalTargetNextQuarter = nextQuarterTargets.reduce((sum, target) => {
          return sum + (parseFloat(target.target?.toString() || "0") || 0);
        }, 0);
      }

      setTargetMcvNextQuarter(totalTargetNextQuarter);

      // Calculate Annual Achieved and Target for selected Financial Year
      // Use the selected FY date range (fyStartYear and fyEndYear already declared above)
      
      // Calculate Annual Achieved: Sum of achieved MCV for all months in selected FY
      let totalAnnualAchieved = 0;
      
      // If filtering by NSO or all NSOs, process New Acquisition mandates
      if (isNsoFilterActive(filterNso)) {
        // For NSO filter, only process New Acquisition mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Acquisition' (should always be true when filtering by NSO)
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  const [year, month] = monthYear.split('-');
                  const yearNum = parseInt(year);
                  const monthNum = parseInt(month);
                  const monthDate = new Date(yearNum, monthNum - 1, 1);
                  const achievedMcv = getAchievedMcv(monthRecord);
                  
                  if (monthInSelectedFY(monthDate)) {
                    totalAnnualAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell") {
        // For "All Cross Sell", calculate from mandates with type = 'New Cross Sell'
        // Only count achieved MCV for months that fall within the selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Cross Sell'
            if (mandate.type === "New Cross Sell") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                    const monthDate = new Date(yearNum, monthNum - 1, 1);
                  const achievedMcv = getAchievedMcv(monthRecord);
                    
                    if (monthInSelectedFY(monthDate)) {
                      totalAnnualAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "Existing") {
        // For "Existing" status, calculate from mandates with type = 'Existing'
        // Only count achieved MCV for months that fall within the selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'Existing'
            if (mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                    const monthDate = new Date(yearNum, monthNum - 1, 1);
                  const achievedMcv = getAchievedMcv(monthRecord);
                    
                    if (monthInSelectedFY(monthDate)) {
                      totalAnnualAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell + Existing") {
        // For "All Cross Sell + Existing", calculate from mandates with type = 'New Cross Sell' OR 'Existing'
        // Only count achieved MCV for months that fall within the selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Include mandates with type = 'New Cross Sell' or 'Existing'
            if (mandate.type === "New Cross Sell" || mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                    const monthDate = new Date(yearNum, monthNum - 1, 1);
                  const achievedMcv = getAchievedMcv(monthRecord);
                    
                    if (monthInSelectedFY(monthDate)) {
                      totalAnnualAchieved += achievedMcv;
                  }
                });
              }
            }
          });
        }
      } else {
        // For other statuses (including "All mandate types"), use all mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            const monthlyData = mandate.monthly_data;
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                const [year, month] = monthYear.split('-');
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                const monthDate = new Date(yearNum, monthNum - 1, 1);
                const achievedMcv = getAchievedMcv(monthRecord);
                
                if (monthInSelectedFY(monthDate)) {
                  totalAnnualAchieved += achievedMcv;
                }
              });
            }
          });
        }
      }

      // Annual / quarter targets: totalAnnualTarget & totalQuarterTarget from manager_targets (computed above)
      setAnnualAchieved(totalAnnualAchieved);
      setAnnualTarget(totalAnnualTarget);

      // When month filter is full FY, MCV Achieved card reflects FY totals (Target MCV card already uses FY sum).
      if (!isMonthScoped) {
        setFfmAchieved(totalAnnualAchieved);
        const fullFyPercentage =
          targetMcvCardPlanned > 0
            ? (totalAnnualAchieved / targetMcvCardPlanned) * 100
            : 0;
        setFfmAchievedFyPercentage(fullFyPercentage);
      }

      // Quarter target: totalQuarterTarget from manager_targets (computed above)
      // Reuse mcvThisQuarter for quarterAchieved since they're the same calculation
      setQuarterAchieved(totalMcvThisQuarter);
      setQuarterTarget(totalQuarterTarget);

      // Calculate Current Month Achieved and Target
      // Note: currentMonthYear is already declared above (line 705)
      
      // Calculate Current Month Achieved: Sum of achieved MCV for current month from all mandates
      let totalCurrentMonthAchieved = 0;
      
      // If filtering by NSO or all NSOs, process New Acquisition mandates
      if (isNsoFilterActive(filterNso)) {
        // For NSO filter, only process New Acquisition mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Acquisition' (should always be true when filtering by NSO)
            if (mandate.type === "New Acquisition") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                    // Check if this is the current month and within selected FY
                    if (monthYear === currentMonthYear) {
                      const [yearStr, monthStr] = monthYear.split('-');
                      const year = parseInt(yearStr);
                      const month = parseInt(monthStr);
                      const monthDate = new Date(year, month - 1, 1);
                      
                      if (includeInDashboardPeriod(monthDate, monthYear)) {
                        const achievedMcv = getAchievedMcv(monthRecord);
                        totalCurrentMonthAchieved += achievedMcv;
                      }
                    }
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "All Cross Sell") {
        // For "All Cross Sell", calculate from mandates with type = 'New Cross Sell'
        // Only count achieved MCV for current month that falls within selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'New Cross Sell'
            if (mandate.type === "New Cross Sell") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                    // Check if this is the current month and within selected FY
                    if (monthYear === currentMonthYear) {
                      const [yearStr, monthStr] = monthYear.split('-');
                      const year = parseInt(yearStr);
                      const month = parseInt(monthStr);
                      const monthDate = new Date(year, month - 1, 1);
                      
                      if (includeInDashboardPeriod(monthDate, monthYear)) {
                        const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                        totalCurrentMonthAchieved += achievedMcv;
                      }
                    }
                  }
                });
              }
            }
          });
        }
      } else if (filterUpsellStatus === "Existing") {
        // For "Existing" status, calculate from mandates with type = 'Existing'
        // Only count achieved MCV for current month that falls within selected FY
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            // Ensure mandate type is 'Existing'
            if (mandate.type === "Existing") {
              const monthlyData = mandate.monthly_data;
              if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
                Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                  if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                    // Check if this is the current month and within selected FY
                    if (monthYear === currentMonthYear) {
                      const [yearStr, monthStr] = monthYear.split('-');
                      const year = parseInt(yearStr);
                      const month = parseInt(monthStr);
                      const monthDate = new Date(year, month - 1, 1);
                      
                      if (includeInDashboardPeriod(monthDate, monthYear)) {
                        const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                        totalCurrentMonthAchieved += achievedMcv;
                      }
                    }
                  }
                });
              }
            }
          });
        }
      } else {
        // For other statuses (including "All mandate types"), use all mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
            const monthlyData = mandate.monthly_data;
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                // Check if this is the current month and within selected FY
                if (monthYear === currentMonthYear) {
                  const [yearStr, monthStr] = monthYear.split('-');
                  const year = parseInt(yearStr);
                  const month = parseInt(monthStr);
                  const monthDate = new Date(year, month - 1, 1);
                  
                  if (includeInDashboardPeriod(monthDate, monthYear)) {
                    const achievedMcv = getAchievedMcv(monthRecord);
                    totalCurrentMonthAchieved += achievedMcv;
                  }
                }
              });
            }
          });
        }
      }
      
      // Current month target: manager_targets (org view) or monthly_targets (KAM/NSO filter)
      let totalCurrentMonthTarget = 0;
      if (hasPersonFilter()) {
        const inactive = inactiveMandateIdsRef.current;
        let monthCardTargets = filterTargetsByKamNso(kamTargetsData || []);
        monthCardTargets = filterMonthlyTargetsByUpsellStatus(
          monthCardTargets,
          filterUpsellStatus,
          mandateTypeById
        );
        totalCurrentMonthTarget = sumMonthlyTargetValues(
          monthCardTargets,
          inactive,
          (monthDate, monthYearKey) =>
            monthYearKey === currentMonthYear &&
            includeInDashboardPeriod(monthDate, monthYearKey)
        );
      } else {
        totalCurrentMonthTarget = sumManagerTargetsForMonth(
          managerTargetsFyRows,
          refMonth,
          refYear,
          filterUpsellStatus
        );
      }

      setCurrentMonthAchieved(totalCurrentMonthAchieved);
      setCurrentMonthTarget(totalCurrentMonthTarget);

      // Fetch Dropped Sales and Reasons data
      let droppedDealsQuery: any = withExcludedTestKams(
        supabase
          .from("pipeline_deals")
          .select("dropped_reason, account_id")
          .eq("status", "Dropped")
          .not("dropped_reason", "is", null),
      );
      if (scopedAccountIds.length > 0) {
        droppedDealsQuery = droppedDealsQuery.in("account_id", scopedAccountIds);
      } else if (selectedTeam !== "all") {
        droppedDealsQuery = droppedDealsQuery.eq(
          "account_id",
          "00000000-0000-0000-0000-000000000000"
        );
      }
      const { data: droppedDeals, error: droppedDealsError } = await droppedDealsQuery;

      // Count deals by dropped reason
      const reasonCounts: Record<string, number> = {
        "Client Unresponsive": 0,
        "Requirement not Feasible": 0,
        "Commercials above Client's Threshold": 0,
        "Others": 0,
      };

      if (!droppedDealsError && droppedDeals) {
        droppedDeals.forEach((deal: any) => {
          const reason = deal.dropped_reason;
          if (reason) {
            // Normalize the reason text for matching (case-insensitive, handle variations)
            const normalizedReason = reason.trim();
            
            // Map variations to standard names
            if (normalizedReason.toLowerCase() === "client unresponsive") {
              reasonCounts["Client Unresponsive"]++;
            } else if (
              normalizedReason.toLowerCase() === "requirement not feasible" ||
              normalizedReason.toLowerCase() === "requirement not feasable" // Handle typo
            ) {
              reasonCounts["Requirement not Feasible"]++;
            } else if (
              normalizedReason.toLowerCase() === "commercials above client's threshold" ||
              normalizedReason.toLowerCase().includes("commercials above")
            ) {
              reasonCounts["Commercials above Client's Threshold"]++;
            } else if (
              normalizedReason.toLowerCase() === "others" ||
              normalizedReason.toLowerCase().startsWith("others")
            ) {
              reasonCounts["Others"]++;
            } else {
              // If reason doesn't match any standard, count it as "Others"
              reasonCounts["Others"]++;
            }
          }
        });
      }

      // Format data for pie chart with colors
      const droppedSalesChartData = [
        {
          name: "Client Unresponsive",
          value: reasonCounts["Client Unresponsive"],
          color: "#FFA500", // Orange
        },
        {
          name: "Requirement not Feasible",
          value: reasonCounts["Requirement not Feasible"],
          color: "#FF6B6B", // Red/Coral - different color
        },
        {
          name: "Others",
          value: reasonCounts["Others"],
          color: "#32CD32", // Green
        },
        {
          name: "Commercials above Client's Threshold",
          value: reasonCounts["Commercials above Client's Threshold"],
          color: "#9370DB", // Purple
        },
      ].filter((item) => item.value > 0); // Only show reasons that have deals

      setDroppedSalesData(droppedSalesChartData);

      // Calculate MCV Tier and Company Size Tier data
      const monthColumns: Array<{ month: number; year: number; key: string; label: string }> =
        isMonthScoped && scopedMonthPair
          ? [
              {
                month: scopedMonthPair.month,
                year: scopedMonthPair.year,
                key: scopedMonthPair.key,
                label: scopedMonthPair.label,
              },
            ]
          : fyMonthsList.map((c) => ({
              month: c.month,
              year: c.year,
              key: c.key,
              label: c.label,
            }));

      // Fetch all accounts (we need all accounts that have mandates to determine MCV Tier)
      const { data: accountsData, error: accountsTierError } = await supabase
        .from("accounts")
        .select("id, company_size_tier");

      // Fetch mandates with account_id and monthly_data
      // Apply status filter to only consider mandates with the selected status
      let mandatesTierQuery = applyTeamFilter(
        supabase
          .from("mandates")
          .select("id, account_id, monthly_data, type, lifecycle_status"),
      );
      mandatesTierQuery = applyStatusFilter(mandatesTierQuery, filterUpsellStatus, isNsoFilterActive(filterNso));
      mandatesTierQuery = applyKamFilter(mandatesTierQuery, filterKam, filterNso);
      mandatesTierQuery = applyLobFilter(mandatesTierQuery);
      mandatesTierQuery = withExcludedTestKams(mandatesTierQuery);
      const { data: mandatesTierDataRaw, error: mandatesTierError } =
        await mandatesTierQuery;
      const mandatesTierData = filterMandatesForRollups(
        withoutTestProfileRows(mandatesTierDataRaw),
        hasAchievedMcvForRollupInclusion,
      );

      // Calculate total achieved MCV for each account from all mandates to determine MCV Tier dynamically
      const accountTotalMcv: Record<string, number> = {};
      if (!mandatesTierError && mandatesTierData) {
        mandatesTierData.forEach((mandate: any) => {
          const accountId = mandate.account_id;
          if (!accountId) return;
          
          const monthlyData = mandate.monthly_data;
          if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
            // Sum all achieved MCV values across all months for this mandate
            Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                // Check if this month falls within the selected financial year
                const [yearStr, monthStr] = monthYear.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr);
                const monthDate = new Date(year, month - 1, 1);
                
                if (includeInDashboardPeriod(monthDate, monthYear)) {
                const achievedMcv = getAchievedMcv(monthRecord);
                  accountTotalMcv[accountId] = (accountTotalMcv[accountId] || 0) + achievedMcv;
              }
            });
          }
        });
      }

      // Create account tier map with dynamically calculated MCV Tier
      const accountTierMap: Record<string, { mcvTier: string | null; companySizeTier: string | null }> = {};
      if (accountsData) {
        accountsData.forEach((account: any) => {
          // Calculate MCV Tier dynamically based on total achieved MCV (sum of all mandates)
          // Tier 1: Total MCV > 1 CR (10,000,000), otherwise default to Tier 2
          const totalMcv = accountTotalMcv[account.id] || 0;
          const mcvTier = totalMcv > 10000000 ? "Tier 1" : "Tier 2";
          
          accountTierMap[account.id] = {
            mcvTier: mcvTier,
            companySizeTier: account.company_size_tier,
          };
        });
      }

      // Initialize tier data structure
      const tierDataMap: Record<string, Record<string, number>> = {
        "MCV Tier_Tier 1": {},
        "MCV Tier_Tier 2": {},
      };

      // Initialize all months with 0
      monthColumns.forEach((col) => {
        Object.keys(tierDataMap).forEach((key) => {
          tierDataMap[key][col.key] = 0;
        });
      });

      // Calculate cumulative achieved MCV for each tier and month
      // First, collect all achieved MCV values by month and tier
      const monthlyTierData: Record<string, Record<string, number>> = {
        "MCV Tier_Tier 1": {},
        "MCV Tier_Tier 2": {},
      };

      if (!mandatesTierError && mandatesTierData) {
        console.log(`[MCV Tier] Processing ${mandatesTierData.length} mandates for tier calculation`);
        console.log(`[MCV Tier] FY Date Range: ${fyDateRange.start.toISOString()} to ${fyDateRange.end.toISOString()}`);
        console.log(`[MCV Tier] Month columns:`, monthColumns.map(col => col.key));
        
        mandatesTierData.forEach((mandate: any) => {
          const accountId = mandate.account_id;
          const accountTiers = accountTierMap[accountId];
          
          if (!accountTiers) return;

          const monthlyData = mandate.monthly_data;
          if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
            Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
              // Skip if monthRecord is null or undefined
              if (monthRecord === null || monthRecord === undefined) return;
              
              // Use getAchievedMcv helper to handle both old format (array) and new format (number)
              const achievedMcv = getAchievedMcv(monthRecord);
              
              // Check if this month falls within the selected financial year
              const [yearStr, monthStr] = monthYear.split('-');
              const year = parseInt(yearStr);
              const month = parseInt(monthStr);
              
              // Skip if year/month parsing failed
              if (isNaN(year) || isNaN(month)) return;
              
              const monthDate = new Date(year, month - 1, 1);
              const isInFYRange = includeInDashboardPeriod(monthDate, monthYear);
              const isInMonthColumns = monthColumns.some((col) => col.key === monthYear);
              
              // Debug logging for months with data
              if (achievedMcv > 0) {
                console.log(`[MCV Tier] Found data for ${monthYear}: achievedMcv=${achievedMcv}, isInFYRange=${isInFYRange}, isInMonthColumns=${isInMonthColumns}, accountTier=${accountTiers.mcvTier}`);
              }
              
              // Only include if within selected FY date range and in our month columns
              if (isInFYRange && isInMonthColumns) {
                // Add achieved MCV to the appropriate tier buckets (include 0 values)
                if (accountTiers.mcvTier === "Tier 1") {
                  monthlyTierData["MCV Tier_Tier 1"][monthYear] = (monthlyTierData["MCV Tier_Tier 1"][monthYear] || 0) + achievedMcv;
                } else if (accountTiers.mcvTier === "Tier 2") {
                  monthlyTierData["MCV Tier_Tier 2"][monthYear] = (monthlyTierData["MCV Tier_Tier 2"][monthYear] || 0) + achievedMcv;
                }
              }
            });
          }
        });
        
        console.log(`[MCV Tier] Monthly tier data after processing:`, monthlyTierData);
      }

      // Fetch targets from monthly_targets table
      // Convert FY filter to financial_year format
      const tierFyYearMatch = filterFinancialYear.match(/FY(\d{2})/);
      const tierFinancialYearString = tierFyYearMatch 
        ? (() => {
            const startYear = 2000 + parseInt(tierFyYearMatch[1], 10);
            const endYearDigits = String(parseInt(tierFyYearMatch[1], 10) + 1).padStart(2, '0');
            return `${startYear}-${endYearDigits}`;
          })()
        : null;

      // Target per tier/month = sum(upsell/existing mandate targets for all mandates on tier accounts)
      //                     + sum(cross-sell targets for all tier accounts)
      const tierMandateToAccountMap: Record<string, string> = {};

      let tierMandatesForTargetsQuery = withExcludedTestKams(
        applyTeamFilter(
          supabase
            .from("mandates")
            .select("id, account_id, lifecycle_status, monthly_data")
            .not("account_id", "is", null),
        ),
      );
      const { data: tierMandatesForTargetsRaw } = await tierMandatesForTargetsQuery;
      const tierMandatesForTargets = filterMandatesForRollups(
        withoutTestProfileRows(tierMandatesForTargetsRaw),
        hasAchievedMcvForRollupInclusion,
      );
      tierMandatesForTargets.forEach((mandate: any) => {
        if (mandate.id && mandate.account_id) {
          tierMandateToAccountMap[mandate.id] = mandate.account_id;
        }
      });

      let tierTargetsQuery = supabase
        .from("monthly_targets")
        .select("account_id, mandate_id, month, year, target, target_type")
        .in("target_type", ["existing", "new_cross_sell"]);

      if (tierFinancialYearString) {
        tierTargetsQuery = tierTargetsQuery.eq("financial_year", tierFinancialYearString);
      }
      if (isMonthScoped && scopedMonthPair) {
        tierTargetsQuery = tierTargetsQuery
          .eq("month", scopedMonthPair.month)
          .eq("year", scopedMonthPair.year);
      }
      tierTargetsQuery = withExcludedTestKams(tierTargetsQuery);

      const { data: tierTargetsDataRaw, error: tierTargetsError } =
        await tierTargetsQuery;
      const tierTargetsData = filterTargetsByTestProfiles(
        tierTargetsDataRaw,
        testExclusions,
      );

      const inactiveTierMandates = inactiveMandateIdsRef.current;

      const tierTargetData: Record<string, Record<string, number>> = {
        "MCV Tier_Tier 1": {},
        "MCV Tier_Tier 2": {},
      };

      monthColumns.forEach((col) => {
        Object.keys(tierTargetData).forEach((key) => {
          tierTargetData[key][col.key] = 0;
        });
      });

      const addTargetToTierBucket = (accountId: string, monthYear: string, value: number) => {
        if (value <= 0) return;
        const accountTiers = accountTierMap[accountId];
        if (!accountTiers?.mcvTier) return;
        if (!monthColumns.some((col) => col.key === monthYear)) return;
        const tierKey = `MCV Tier_${accountTiers.mcvTier}`;
        tierTargetData[tierKey][monthYear] =
          (tierTargetData[tierKey][monthYear] || 0) + value;
      };

      if (!tierTargetsError && tierTargetsData) {
        tierTargetsData.forEach((target: any) => {
          const targetValue = parseFloat(target.target?.toString() || "0") || 0;
          if (targetValue <= 0) return;

          const monthYear = `${target.year}-${String(target.month).padStart(2, "0")}`;

          if (target.target_type === "existing" && target.mandate_id) {
            if (inactiveTierMandates.has(target.mandate_id as string)) return;
            const accountId =
              tierMandateToAccountMap[target.mandate_id] ?? target.account_id;
            if (!accountId || !accountTierMap[accountId]) return;
            addTargetToTierBucket(accountId, monthYear, targetValue);
            return;
          }

          if (target.target_type === "new_cross_sell" && target.account_id) {
            if (!accountTierMap[target.account_id]) return;
            addTargetToTierBucket(target.account_id, monthYear, targetValue);
          }
        });
      }

      // Calculate cumulative values for Actual (achieved MCV)
      const tierActualData: Record<string, Record<string, number>> = {
        "MCV Tier_Tier 1": {},
        "MCV Tier_Tier 2": {},
      };

      // Past vs current month for tier chart uses real calendar "today" (not the FY month filter)
      monthColumns.forEach((col, index) => {
        Object.keys(tierDataMap).forEach((tierKey) => {
          // Get current month's value
          const currentMonthValue = monthlyTierData[tierKey][col.key] || 0;
          
          const isPastMonth = col.year < calendarYear || 
            (col.year === calendarYear && col.month < calendarMonth);
          
          const isCurrentMonth = col.year === calendarYear && col.month === calendarMonth;
          
          // Get previous cumulative value (from previous month)
          const prevCumulative = index > 0 
            ? tierDataMap[tierKey][monthColumns[index - 1].key] || 0
            : 0;
          
          // Calculate cumulative based on month type and data availability
          if (isPastMonth) {
            // Past month: always calculate cumulative (carry forward even if 0)
            tierDataMap[tierKey][col.key] = prevCumulative + currentMonthValue;
            tierActualData[tierKey][col.key] = prevCumulative + currentMonthValue;
          } else if (isCurrentMonth) {
            // Current month: only show cumulative if there's data, otherwise show 0
            if (currentMonthValue > 0) {
              tierDataMap[tierKey][col.key] = prevCumulative + currentMonthValue;
              tierActualData[tierKey][col.key] = prevCumulative + currentMonthValue;
            } else {
              tierDataMap[tierKey][col.key] = 0;
              tierActualData[tierKey][col.key] = 0;
            }
          } else {
            // Future month: only show cumulative if there's data, otherwise show 0
            if (currentMonthValue > 0) {
              tierDataMap[tierKey][col.key] = prevCumulative + currentMonthValue;
              tierActualData[tierKey][col.key] = prevCumulative + currentMonthValue;
            } else {
              tierDataMap[tierKey][col.key] = 0;
              tierActualData[tierKey][col.key] = 0;
            }
          }
        });
      });

      // Calculate cumulative targets
      const tierCumulativeTargetData: Record<string, Record<string, number>> = {
        "MCV Tier_Tier 1": {},
        "MCV Tier_Tier 2": {},
      };

      monthColumns.forEach((col, index) => {
        Object.keys(tierCumulativeTargetData).forEach((tierKey) => {
          const currentMonthTarget = tierTargetData[tierKey][col.key] || 0;
          const prevCumulativeTarget = index > 0 
            ? tierCumulativeTargetData[tierKey][monthColumns[index - 1].key] || 0
            : 0;
          
          tierCumulativeTargetData[tierKey][col.key] = prevCumulativeTarget + currentMonthTarget;
        });
      });

      // Full financial-year columns → "Total" values (sum of all month columns per row)

      // Convert to array format for display - 4 rows per tier
      const formattedTierData: Array<{
        category: string;
        tier: string;
        rowType: string;
        lastQuarter?: string | number;
        [key: string]: string | number | undefined;
      }> = [];

      // For each tier, create 4 rows
      ["Tier 1", "Tier 2"].forEach((tier) => {
        const tierKey = `MCV Tier_${tier}`;
        
        // Row 1: Target (only this row shows category and tier)
        // Show non-cumulative values - each month shows only its own target
        formattedTierData.push({
          category: "MCV Tier",
          tier: tier,
          rowType: "Target",
          lastQuarter: formatCurrency(
            monthColumns.reduce((s, c) => s + (tierTargetData[tierKey][c.key] || 0), 0)
          ),
          ...monthColumns.reduce((acc, col) => {
            const value = tierTargetData[tierKey][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        });

        // Row 2: Actual (empty category and tier)
        // Show non-cumulative values - each month shows only its own achieved MCV
        formattedTierData.push({
          category: "",
          tier: "",
          rowType: "Actual",
          lastQuarter: formatCurrency(
            monthColumns.reduce((s, c) => s + (monthlyTierData[tierKey][c.key] || 0), 0)
          ),
          ...monthColumns.reduce((acc, col) => {
            // Use monthlyTierData for non-cumulative actual values
            const value = monthlyTierData[tierKey][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        });

        // Row 3: Achievement (Percentage) (empty category and tier)
        // Compare non-cumulative actual with non-cumulative target
        formattedTierData.push({
          category: "",
          tier: "",
          rowType: "Achievement",
          lastQuarter: (() => {
            const totalTarget = monthColumns.reduce(
              (s, c) => s + (tierTargetData[tierKey][c.key] || 0),
              0
            );
            const totalActual = monthColumns.reduce(
              (s, c) => s + (monthlyTierData[tierKey][c.key] || 0),
              0
            );
            const pct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
            return `${pct.toFixed(1)}%`;
          })(),
          ...monthColumns.reduce((acc, col) => {
            const target = tierTargetData[tierKey][col.key] || 0;
            const actual = monthlyTierData[tierKey][col.key] || 0;
            const percentage = target > 0 ? (actual / target) * 100 : 0;
            acc[col.key] = `${percentage.toFixed(1)}%`;
            return acc;
          }, {} as Record<string, string>),
        });

        // Row 4: Balance (Target - Actual) (empty category and tier)
        // Store raw numeric value for Balance row to enable color coding
        // Compare non-cumulative target with non-cumulative actual
        formattedTierData.push({
          category: "",
          tier: "",
          rowType: "Balance",
          lastQuarter: monthColumns.reduce((s, c) => {
            const target = tierTargetData[tierKey][c.key] || 0;
            const actual = monthlyTierData[tierKey][c.key] || 0;
            return s + (target - actual);
          }, 0),
          ...monthColumns.reduce((acc, col) => {
            const target = tierTargetData[tierKey][col.key] || 0;
            const actual = monthlyTierData[tierKey][col.key] || 0;
            const balance = target - actual;
            // Store raw numeric value (will be formatted with colors in display)
            acc[col.key] = balance;
            return acc;
          }, {} as Record<string, number | string>),
        });
      });

      // Total: Tier 1 + Tier 2 — same 4 rows, month-wise sums
      const tier1Key = "MCV Tier_Tier 1";
      const tier2Key = "MCV Tier_Tier 2";
      formattedTierData.push({
        category: "Total",
        tier: "Tier 1 + Tier 2",
        rowType: "Target",
        lastQuarter: formatCurrency(
          monthColumns.reduce((s, c) => {
            const t1 = tierTargetData[tier1Key][c.key] || 0;
            const t2 = tierTargetData[tier2Key][c.key] || 0;
            return s + t1 + t2;
          }, 0)
        ),
        ...monthColumns.reduce((acc, col) => {
          const t1 = tierTargetData[tier1Key][col.key] || 0;
          const t2 = tierTargetData[tier2Key][col.key] || 0;
          acc[col.key] = formatCurrency(t1 + t2);
          return acc;
        }, {} as Record<string, string>),
      });
      formattedTierData.push({
        category: "",
        tier: "",
        rowType: "Actual",
        lastQuarter: formatCurrency(
          monthColumns.reduce((s, c) => {
            const a1 = monthlyTierData[tier1Key][c.key] || 0;
            const a2 = monthlyTierData[tier2Key][c.key] || 0;
            return s + a1 + a2;
          }, 0)
        ),
        ...monthColumns.reduce((acc, col) => {
          const a1 = monthlyTierData[tier1Key][col.key] || 0;
          const a2 = monthlyTierData[tier2Key][col.key] || 0;
          acc[col.key] = formatCurrency(a1 + a2);
          return acc;
        }, {} as Record<string, string>),
      });
      formattedTierData.push({
        category: "",
        tier: "",
        rowType: "Achievement",
        lastQuarter: (() => {
          const totalTarget = monthColumns.reduce((s, c) => {
            return (
              s +
              (tierTargetData[tier1Key][c.key] || 0) +
              (tierTargetData[tier2Key][c.key] || 0)
            );
          }, 0);
          const totalActual = monthColumns.reduce((s, c) => {
            return (
              s +
              (monthlyTierData[tier1Key][c.key] || 0) +
              (monthlyTierData[tier2Key][c.key] || 0)
            );
          }, 0);
          const pct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
          return `${pct.toFixed(1)}%`;
        })(),
        ...monthColumns.reduce((acc, col) => {
          const totalTarget = (tierTargetData[tier1Key][col.key] || 0) + (tierTargetData[tier2Key][col.key] || 0);
          const totalActual = (monthlyTierData[tier1Key][col.key] || 0) + (monthlyTierData[tier2Key][col.key] || 0);
          const percentage = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
          acc[col.key] = `${percentage.toFixed(1)}%`;
          return acc;
        }, {} as Record<string, string>),
      });
      formattedTierData.push({
        category: "",
        tier: "",
        rowType: "Balance",
        lastQuarter: monthColumns.reduce((s, c) => {
          const totalTarget = (tierTargetData[tier1Key][c.key] || 0) + (tierTargetData[tier2Key][c.key] || 0);
          const totalActual = (monthlyTierData[tier1Key][c.key] || 0) + (monthlyTierData[tier2Key][c.key] || 0);
          return s + (totalTarget - totalActual);
        }, 0),
        ...monthColumns.reduce((acc, col) => {
          const totalTarget = (tierTargetData[tier1Key][col.key] || 0) + (tierTargetData[tier2Key][col.key] || 0);
          const totalActual = (monthlyTierData[tier1Key][col.key] || 0) + (monthlyTierData[tier2Key][col.key] || 0);
          acc[col.key] = totalTarget - totalActual;
          return acc;
        }, {} as Record<string, number | string>),
      });

      setMcvTierData(formattedTierData);
      setTierMonthColumns(monthColumns);
      // Upsell data will be computed via useMemo based on raw data and filter
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };




  // Helper function to ensure minimum bar length for visibility
  const ensureMinimumBarLength = (achieved: number, target: number): number => {
    if (target === 0) return achieved;
    // If achieved is 0, don't show a bar
    if (achieved === 0) return 0;
    // Ensure achieved is at least 2% of target for visibility, but don't exceed actual value if it's already larger
    const minValue = target * 0.02;
    return Math.max(achieved, minValue);
  };

  // Helper function to ensure minimum bar length for both target and achieved bars
  const ensureMinimumBarLengthForBoth = (value: number, maxValue: number): number => {
    if (maxValue === 0) return value;
    // If value is 0, don't show a bar
    if (value === 0) return 0;
    // Ensure value is at least 2% of maxValue for visibility, but don't exceed actual value if it's already larger
    const minValue = maxValue * 0.02;
    return Math.max(value, minValue);
  };

  // Calculate actualVsTargetAnnual dynamically based on state - stacked bars
  // Base = smaller value, Overlay = difference (bigger - smaller)
  // This way: smaller bar starts from Y-axis, bigger bar overlays on top
  const isAchievedGreater = annualAchieved > annualTarget;
  const smallerValue = isAchievedGreater ? annualTarget : annualAchieved;
  const biggerValue = isAchievedGreater ? annualAchieved : annualTarget;
  const difference = biggerValue - smallerValue;
  
  const actualVsTargetAnnual = [
    { 
      name: "", 
      base: smallerValue, // Smaller value as base (starts from Y-axis)
      overlay: difference, // Difference stacked on top (bigger - smaller)
      achieved: annualAchieved, // Original achieved value for tooltip
      target: annualTarget, // Original target value for tooltip
    },
  ];

  // Calculate actualVsTargetQ2 dynamically based on state - stacked bars
  // Base = smaller value, Overlay = difference (bigger - smaller)
  const isQuarterAchievedGreater = quarterAchieved > quarterTarget;
  const quarterSmallerValue = isQuarterAchievedGreater ? quarterTarget : quarterAchieved;
  const quarterBiggerValue = isQuarterAchievedGreater ? quarterAchieved : quarterTarget;
  const quarterDifference = quarterBiggerValue - quarterSmallerValue;
  
  const actualVsTargetQ2 = [
    { 
      name: "", 
      base: quarterSmallerValue, // Smaller value as base (starts from Y-axis)
      overlay: quarterDifference, // Difference stacked on top (bigger - smaller)
      achieved: quarterAchieved, // Original achieved value for tooltip
      target: quarterTarget, // Original target value for tooltip
    },
  ];

  // Calculate actualVsTargetCurrent dynamically based on state - stacked bars
  // Base = smaller value, Overlay = difference (bigger - smaller)
  const isCurrentMonthAchievedGreater = currentMonthAchieved > currentMonthTarget;
  const currentMonthSmallerValue = isCurrentMonthAchievedGreater ? currentMonthTarget : currentMonthAchieved;
  const currentMonthBiggerValue = isCurrentMonthAchievedGreater ? currentMonthAchieved : currentMonthTarget;
  const currentMonthDifference = currentMonthBiggerValue - currentMonthSmallerValue;
  
  const actualVsTargetCurrent = [
    { 
      name: "", 
      base: currentMonthSmallerValue, // Smaller value as base (starts from Y-axis)
      overlay: currentMonthDifference, // Difference stacked on top (bigger - smaller)
      achieved: currentMonthAchieved, // Original achieved value for tooltip
      target: currentMonthTarget, // Original target value for tooltip
    },
  ];

  // Helper function to format number with Indian style commas (first comma after 3 digits, then every 2 digits)
  const formatIndianNumber = (num: number): string => {
    // Round to 2 decimal places
    const rounded = Math.round(num * 100) / 100;
    
    // Split into integer and decimal parts
    const parts = rounded.toString().split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : '';
    
    // Add Indian style commas
    // First comma after 3 digits from right, then every 2 digits
    let formatted = '';
    const len = integerPart.length;
    
    if (len <= 3) {
      formatted = integerPart;
    } else {
      // First 3 digits
      formatted = integerPart.slice(-3);
      integerPart = integerPart.slice(0, -3);
      
      // Then every 2 digits
      while (integerPart.length > 0) {
        if (integerPart.length >= 2) {
          formatted = integerPart.slice(-2) + ',' + formatted;
          integerPart = integerPart.slice(0, -2);
        } else {
          formatted = integerPart + ',' + formatted;
          integerPart = '';
        }
      }
    }
    
    // Add decimal part if exists, pad to 2 decimal places if needed
    if (decimalPart) {
      const paddedDecimal = decimalPart.padEnd(2, '0').slice(0, 2);
      return formatted + '.' + paddedDecimal;
    }
    
    return formatted;
  };

  const formatCurrency = (value: number | string): string => {
    if (typeof value === "string") return value;
    
    // Round to 2 decimal places first
    const roundedValue = Math.round(value * 100) / 100;
    
    if (roundedValue >= 10000000) {
      return `₹${formatIndianNumber(roundedValue / 10000000)} Cr`;
    } else if (roundedValue >= 100000) {
      return `₹${formatIndianNumber(roundedValue / 100000)} L`;
    }
    return `₹${formatIndianNumber(roundedValue)}`;
  };

  // Formatter for tooltip values (without currency symbol)
  const formatTooltipValue = (value: number): string => {
    return formatIndianNumber(value);
  };

  const selectedLobLabel =
    selectedLobs.length === 0
      ? "All LoBs"
      : selectedLobs.length === 1
        ? selectedLobs[0]
        : `${selectedLobs.length} LoBs selected`;

  const ActualVsTargetBarTooltip = ({
    active,
    payload,
    targetField = "target",
    achievedField = "achieved",
  }: {
    active?: boolean;
    payload?: Array<{ payload?: Record<string, unknown> }>;
    targetField?: string;
    achievedField?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    const target = Number(row[targetField]) || 0;
    const achieved = Number(row[achievedField]) || 0;
    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
        <div className="leading-relaxed">
          <span className="font-semibold text-[#1d4ed8]">Achieved</span>
          <span className="text-muted-foreground"> : </span>
          <span className="font-medium tabular-nums text-foreground">{formatTooltipValue(achieved)}</span>
        </div>
        <div className="mt-1 leading-relaxed">
          <span className="font-semibold text-slate-900">Target</span>
          <span className="text-muted-foreground"> : </span>
          <span className="font-medium tabular-nums text-foreground">{formatTooltipValue(target)}</span>
        </div>
      </div>
    );
  };

  /** Same popover + Indian number formatting as Actual vs Target, for a single metric. */
  const DashboardSingleMetricTooltip = ({
    active,
    payload,
    valueKey,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ payload?: Record<string, unknown>; value?: unknown }>;
    valueKey: string;
    label: string;
  }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    const raw =
      row && valueKey in row ? row[valueKey] : (payload[0] as { value?: unknown }).value;
    const num = Number(raw) || 0;
    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
        <div className="leading-relaxed">
          <span className="font-semibold text-[#1d4ed8]">{label}</span>
          <span className="text-muted-foreground"> : </span>
          <span className="font-medium tabular-nums text-foreground">{formatTooltipValue(num)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Main Dashboard Section */}
      <Card className="overflow-hidden bg-blue-100/60">
        <CardContent className="min-w-0 space-y-6 p-4 sm:p-6">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Filters</h3>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            onClick={() => setGuideDialogOpen(true)}
            aria-label="Open dashboard guide"
          >
            <BookOpen className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
        {canSelectAllTeams && (
            <Select
              value={selectedTeam ?? "all"}
              onValueChange={(v) => {
                if (v === "all" || v === "ce" || v === "staffing" || v === "experts") {
                  setSelectedTeam(v);
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  dashboardTeamFilterTriggerClass,
                  isTeamFilterActive && dashboardFilterActiveClass,
                )}
              >
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <TeamSelectItems includeAll allLabel="All teams" />
              </SelectContent>
            </Select>
        )}
        {/* Financial Year Filter */}
        <Select value={filterFinancialYear} onValueChange={setFilterFinancialYear}>
          <SelectTrigger
            className={cn(
              dashboardFilterTriggerClass,
              isFinancialYearFilterActive && dashboardFilterActiveClass,
            )}
          >
            <SelectValue placeholder="Financial Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FY24">{formatFYForDisplay("FY24")}</SelectItem>
            <SelectItem value="FY25">{formatFYForDisplay("FY25")}</SelectItem>
            <SelectItem value="FY26">{formatFYForDisplay("FY26")}</SelectItem>
            <SelectItem value="FY27">{formatFYForDisplay("FY27")}</SelectItem>
            <SelectItem value="FY28">{formatFYForDisplay("FY28")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterDashboardMonth} onValueChange={setFilterDashboardMonth}>
          <SelectTrigger
            className={cn(
              dashboardFilterTriggerClass,
              isMonthFilterActive && dashboardFilterActiveClass,
            )}
          >
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Full Financial Year</SelectItem>
            {dashboardMonthOptions.map((col) => (
              <SelectItem key={col.key} value={col.key}>
                {col.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!canSelectAllTeams && dashboardLobOptions.length === 1 ? (
          <div className={`${dashboardFilterButtonClass} items-center rounded-md border bg-muted/50`}>
            <span className="whitespace-nowrap">{dashboardLobOptions[0]}</span>
          </div>
        ) : (
        <Popover open={lobFilterOpen} onOpenChange={setLobFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={lobFilterOpen}
              className={cn(
                dashboardFilterButtonClass,
                isLobFilterActive && dashboardFilterActiveClass,
              )}
            >
              <span className="whitespace-nowrap text-left">{selectedLobLabel}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(calc(100vw-1.5rem),20rem)] p-0"
            align="start"
            sideOffset={6}
            collisionPadding={12}
          >
            <Command>
              <CommandInput placeholder="Search team or LoB…" />
              <CommandList className="max-h-[min(320px,50vh)]">
                <CommandEmpty>No matches.</CommandEmpty>
                <CommandItem
                  value="all-lobs clear reset"
                  onSelect={() => setSelectedLobs([])}
                  className="font-medium"
                >
                  <span className="min-w-0 flex-1 truncate pr-2 text-left">All LoBs</span>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedLobs.length === 0
                          ? "text-primary opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </span>
                </CommandItem>
                {lobDashboardCategories.map((cat) => {
                  const catState = lobCategorySelectionState(selectedLobs, cat.lobs);
                  const searchBlob = `${cat.label} ${cat.lobs.join(" ")}`;
                  return (
                    <Fragment key={cat.id}>
                      <CommandSeparator className="my-0.5" />
                      <CommandItem
                        className="rounded-md border border-blue-200/80 bg-blue-100/70 py-2 font-semibold text-foreground shadow-sm data-[selected=true]:border-blue-300 data-[selected=true]:bg-blue-200/80 data-[selected=true]:text-foreground data-[selected=true]:shadow-none"
                        value={`lob-cat-${cat.id} ${searchBlob}`}
                        aria-label={`Select or clear all ${cat.label} lines of business`}
                        onSelect={() => {
                          setSelectedLobs((prev) => {
                            const allIn = cat.lobs.every((l) => prev.includes(l));
                            if (allIn) {
                              return chartLobOptions.filter(
                                (l) => prev.includes(l) && !cat.lobs.includes(l),
                              );
                            }
                            const merged = new Set(prev);
                            cat.lobs.forEach((l) => merged.add(l));
                            return chartLobOptions.filter((l) => merged.has(l));
                          });
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate pr-2 text-left">{cat.label}</span>
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {catState === "all" ? (
                            <Check className="h-4 w-4 text-primary opacity-100" />
                          ) : catState === "some" ? (
                            <Minus className="h-4 w-4 text-primary/75 opacity-100" />
                          ) : (
                            <Check className="h-4 w-4 opacity-0" />
                          )}
                        </span>
                      </CommandItem>
                      <CommandSeparator className="my-0.5" />
                      {cat.lobs.map((lob) => (
                        <CommandItem
                          key={`${cat.id}-${lob}`}
                          className="py-1.5 font-normal text-foreground"
                          value={`${cat.id} ${lob}`}
                          onSelect={() => {
                            setSelectedLobs((prev) => {
                              if (prev.includes(lob)) {
                                return chartLobOptions.filter((l) => prev.includes(l) && l !== lob);
                              }
                              return chartLobOptions.filter((l) => prev.includes(l) || l === lob);
                            });
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate pr-2 text-left">{lob}</span>
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedLobs.includes(lob)
                                  ? "text-primary opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </span>
                        </CommandItem>
                      ))}
                    </Fragment>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        )}

        {/* Status Filter */}
        <Select value={filterUpsellStatus} onValueChange={(value) => setFilterUpsellStatus(value)}>
          <SelectTrigger
            className={cn(
              dashboardFilterTriggerClass,
              isMandateTypeFilterActive && dashboardFilterActiveClass,
            )}
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All mandate types">All Mandate Types</SelectItem>
            <SelectItem value="All Cross Sell + Existing">Existing Mandates</SelectItem>
            <SelectItem value="New Acquisitions">New Acquisitions</SelectItem>
          </SelectContent>
        </Select>

        {/* KAM filter — hidden for KAM users */}
        {!isKAM && (
          <Select value={filterKam} onValueChange={setFilterKam}>
            <SelectTrigger
              className={cn(
                dashboardFilterTriggerClass,
                isKamFilterActive(filterKam) && dashboardFilterActiveClass,
              )}
            >
              <SelectValue placeholder="All KAMs">
                {filterKam === "all"
                  ? "All KAMs"
                  : kams.find((k) => k.id === filterKam)?.full_name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All KAMs</SelectItem>
              <div className="px-2 pb-2">
                <Input
                  placeholder="Search KAM..."
                  value={kamSearch}
                  onChange={(e) => setKamSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-8"
                />
              </div>
              {kams
                .filter((kam) =>
                  kam.full_name?.toLowerCase().includes(kamSearch.toLowerCase())
                )
                .map((kam) => (
                  <SelectItem key={kam.id} value={kam.id}>
                    {kam.full_name}
                  </SelectItem>
                ))}
              {kams.filter((kam) =>
                kam.full_name?.toLowerCase().includes(kamSearch.toLowerCase())
              ).length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No KAMs found</div>
              )}
            </SelectContent>
          </Select>
        )}
        {/* NSO filter — hidden for KAM and NSO users */}
        {!isKAM && !isNSO && (
          <Select value={filterNso} onValueChange={setFilterNso}>
            <SelectTrigger
              className={cn(
                dashboardFilterTriggerClass,
                isNsoFilterActive(filterNso) && dashboardFilterActiveClass,
              )}
            >
              <SelectValue placeholder="All NSOs">
                {filterNso === "all"
                  ? "All NSOs"
                  : (() => {
                      const nso = nsos.find((n) => n.mail_id === filterNso);
                      return nso
                        ? `${nso.first_name} ${nso.last_name}`.trim()
                        : filterNso;
                    })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All NSOs</SelectItem>
              <div className="px-2 pb-2">
                <Input
                  placeholder="Search NSO..."
                  value={nsoSearch}
                  onChange={(e) => setNsoSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-8"
                />
              </div>
              {nsos
                .filter(
                  (nso) =>
                    `${nso.first_name} ${nso.last_name}`
                      .toLowerCase()
                      .includes(nsoSearch.toLowerCase()) ||
                    nso.mail_id.toLowerCase().includes(nsoSearch.toLowerCase())
                )
                .map((nso) => (
                  <SelectItem key={nso.mail_id} value={nso.mail_id}>
                    {nso.first_name} {nso.last_name}
                  </SelectItem>
                ))}
              {nsos.filter(
                (nso) =>
                  `${nso.first_name} ${nso.last_name}`
                    .toLowerCase()
                    .includes(nsoSearch.toLowerCase()) ||
                  nso.mail_id.toLowerCase().includes(nsoSearch.toLowerCase())
              ).length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No NSOs found</div>
              )}
            </SelectContent>
          </Select>
        )}
        {hasActiveDashboardFilters && (
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 bg-black text-white hover:bg-black/90 hover:text-white focus-visible:ring-0 focus-visible:ring-offset-0"
            onClick={clearDashboardFilters}
          >
            Clear Filters
          </Button>
        )}
        </div>
      </div>

      {/* Key Metrics Cards - 8 cards in 2 rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Mandates (x) / Total Mandates (y) */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">Active Mandates</p>
                <div className="text-3xl font-bold tabular-nums">
                  {formatNumber(activeMandatesCount)} / {formatNumber(allMandatesCount)}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Accounts */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">Total Accounts</p>
                <div className="text-3xl font-bold">{formatNumber(totalAccounts)}</div>
              </>
            )}
          </CardContent>
        </Card>

        {/* MCV Planned */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">Target MCV</p>
                <div className="text-3xl font-bold">{formatCurrency(mcvPlanned)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {dashboardPeriodLabels.targetMcvFooter}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* FFM Achieved */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">MCV Achieved</p>
                <div className="text-3xl font-bold">{formatCurrency(ffmAchieved)}</div>
                {dashboardPeriodLabels.isScoped ? (
                  <>
                    <p className="text-xs font-medium text-foreground mt-2">
                      {dashboardPeriodLabels.targetMcvMonthFooter}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {`${formatFYForDisplay(filterFinancialYear)} (${ffmAchievedFyPercentage.toFixed(1)}% of Target MCV)`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    {`${formatFYForDisplay(filterFinancialYear)} (${ffmAchievedFyPercentage.toFixed(1)}% of Target MCV)`}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* MCV This Quarter */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">MCV Achieved This Quarter</p>
                <div className="text-3xl font-bold">{formatCurrency(mcvThisQuarter)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {`${formatFYForDisplay(filterFinancialYear)} (${dashboardQuarterLabel}) — ${dashboardPeriodLabels.quarterMonthsFooter}`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* MCV Achieved Last Month */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">MCV Achieved Last Month</p>
                <div className="text-3xl font-bold">{formatCurrency(mcvLastMonth)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {dashboardPeriodLabels.lastMonthFooter}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Target MCV Next Quarter */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">Target MCV Next Quarter</p>
                <div className="text-3xl font-bold">{formatCurrency(targetMcvNextQuarter)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {dashboardPeriodLabels.nextQuarterFooter}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Overlap Factor */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">Overlap Factor</p>
                <div className="text-3xl font-bold">
                  {overlapFactor !== null ? overlapFactor.toFixed(2) : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatNumber(activeMandatesCount)} mandates / {formatNumber(accountsWithActiveMandates)} accounts
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FY26 Actual vs Target Charts - Annual and Q2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Annual */}
        <Card>
          <CardHeader>
            <CardTitle>
              {`${formatFYForDisplay(filterFinancialYear)} Actual vs Target (Annual)`}
            </CardTitle>
            {dashboardPeriodLabels.annualChartSelectedHint && (
              <p className="text-sm text-muted-foreground mt-1">
                {dashboardPeriodLabels.annualChartSelectedHint}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-sm">
                    Target: {formatCurrency(annualTarget)} | Achieved: {formatCurrency(annualAchieved)} | {annualTarget > 0 ? `${((annualAchieved / annualTarget) * 100).toFixed(1)}% of Target` : "N/A"}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart 
                    data={actualVsTargetAnnual} 
                    layout="vertical" 
                    barCategoryGap="20%"
                    barGap={0}
                  >
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <YAxis dataKey="name" type="category" width={80} hide />
                    <Tooltip
                      content={<ActualVsTargetBarTooltip />}
                      cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                    {isAchievedGreater ? (
                      <>
                        {/* Achieved > Target: Grey bar (target/smaller) as base, blue bar (achieved-target/difference) stacked on top */}
                        <Bar 
                          dataKey="base" 
                          fill="#E0E0E0" 
                          name="Target" 
                          stackId="annual"
                          barSize={60}
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar 
                          dataKey="overlay" 
                          fill="#4169E1" 
                          name="Achieved" 
                          stackId="annual"
                          barSize={60}
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        />
                      </>
                    ) : (
                      <>
                        {/* Target > Achieved: Blue bar (achieved/smaller) as base, grey bar (target-achieved/difference) stacked on top */}
                        <Bar 
                          dataKey="base" 
                          fill="#4169E1" 
                          name="Achieved" 
                          stackId="annual"
                          barSize={60}
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar 
                          dataKey="overlay" 
                          fill="#E0E0E0" 
                          name="Target" 
                          stackId="annual"
                          barSize={60}
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>

        {/* Current Quarter */}
        <Card>
          <CardHeader>
            <CardTitle>
              {`${formatFYForDisplay(filterFinancialYear)} Actual vs Target (${dashboardQuarterLabel})`}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {dashboardPeriodLabels.quarterMonthsFooter}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-sm">
                    Target: {formatCurrency(quarterTarget)} | Achieved: {formatCurrency(quarterAchieved)} | {quarterTarget > 0 ? `${((quarterAchieved / quarterTarget) * 100).toFixed(1)}% of Target` : "N/A"}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={actualVsTargetQ2} layout="vertical" barCategoryGap="20%" barGap={0}>
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <YAxis dataKey="name" type="category" width={80} hide />
                    <Tooltip
                      content={<ActualVsTargetBarTooltip />}
                      cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                    {isQuarterAchievedGreater ? (
                      <>
                        {/* Achieved > Target: Grey bar (target/smaller) as base, blue bar (achieved-target/difference) stacked on top */}
                        <Bar 
                          dataKey="base" 
                          fill="#E0E0E0" 
                          name="Target" 
                          stackId="quarter"
                          barSize={60}
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar 
                          dataKey="overlay" 
                          fill="#4169E1" 
                          name="Achieved" 
                          stackId="quarter"
                          barSize={60}
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        />
                      </>
                    ) : (
                      <>
                        {/* Target > Achieved: Blue bar (achieved/smaller) as base, grey bar (target-achieved/difference) stacked on top */}
                        <Bar 
                          dataKey="base" 
                          fill="#4169E1" 
                          name="Achieved" 
                          stackId="quarter"
                          barSize={60}
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar 
                          dataKey="overlay" 
                          fill="#E0E0E0" 
                          name="Target" 
                          stackId="quarter"
                          barSize={60}
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Month and Dropped Sales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Month */}
        <Card>
          <CardHeader>
            <CardTitle>
              {`${formatFYForDisplay(filterFinancialYear)} Actual vs Target (${dashboardPeriodLabels.currentMonthChartTitle})`}
            </CardTitle>
            {dashboardPeriodLabels.isScoped && (
              <p className="text-sm text-muted-foreground mt-1">
                {dashboardPeriodLabels.targetMcvMonthFooter}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-sm">
                    Target: {formatCurrency(currentMonthTarget)} | Achieved: {formatCurrency(currentMonthAchieved)} | {currentMonthTarget > 0 ? `${((currentMonthAchieved / currentMonthTarget) * 100).toFixed(1)}% of Target` : "N/A"}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={actualVsTargetCurrent} layout="vertical" barCategoryGap="20%" barGap={0}>
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <YAxis dataKey="name" type="category" width={80} hide />
                    <Tooltip
                      content={<ActualVsTargetBarTooltip />}
                      cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                    {isCurrentMonthAchievedGreater ? (
                      <>
                        {/* Achieved > Target: Grey bar (target/smaller) as base, blue bar (achieved-target/difference) stacked on top */}
                        <Bar 
                          dataKey="base" 
                          fill="#E0E0E0" 
                          name="Target" 
                          stackId="currentMonth"
                          barSize={60}
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar 
                          dataKey="overlay" 
                          fill="#4169E1" 
                          name="Achieved" 
                          stackId="currentMonth"
                          barSize={60}
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        />
                      </>
                    ) : (
                      <>
                        {/* Target > Achieved: Blue bar (achieved/smaller) as base, grey bar (target-achieved/difference) stacked on top */}
                        <Bar 
                          dataKey="base" 
                          fill="#4169E1" 
                          name="Achieved" 
                          stackId="currentMonth"
                          barSize={60}
                          radius={[0, 0, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar 
                          dataKey="overlay" 
                          fill="#E0E0E0" 
                          name="Target" 
                          stackId="currentMonth"
                          barSize={60}
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dropped Sales and Reasons - Only visible when status filter is "All Cross Sell" */}
        {filterUpsellStatus === "All Cross Sell" && (
          <Card>
            <CardHeader>
              <CardTitle>Dropped Sales and Reasons</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : droppedSalesData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No dropped deals found
                </div>
              ) : (
                <div className="overflow-hidden">
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={droppedSalesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={(props: any) => {
                          const { cx, cy, midAngle, innerRadius, outerRadius, value, name, fill } = props;
                          const total = droppedSalesData.reduce((sum, item) => sum + item.value, 0);
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : "0.00";
                          
                          // Capitalize first letter of each word
                          const capitalizeWords = (text: string) => {
                            return text
                              .split(' ')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                              .join(' ');
                          };
                          
                          const capitalizedName = capitalizeWords(name);
                          
                          // Split long labels into 2 lines to prevent overflow
                          const maxLabelLength = 20;
                          const splitIntoTwoLines = (text: string): string[] => {
                            if (text.length <= maxLabelLength) {
                              return [text];
                            }
                            
                            // Try to split at a word boundary
                            const words = text.split(' ');
                            if (words.length > 1) {
                              let firstLine = '';
                              let secondLine = '';
                              
                              for (const word of words) {
                                if ((firstLine + ' ' + word).trim().length <= maxLabelLength) {
                                  firstLine = (firstLine + ' ' + word).trim();
                                } else {
                                  secondLine = (secondLine + ' ' + word).trim();
                                }
                              }
                              
                              // If we couldn't split at word boundary, split at character
                              if (!secondLine) {
                                firstLine = text.substring(0, maxLabelLength);
                                secondLine = text.substring(maxLabelLength);
                              }
                              
                              return [firstLine, secondLine];
                            }
                            
                            // If no spaces, split at character
                            return [
                              text.substring(0, maxLabelLength),
                              text.substring(maxLabelLength)
                            ];
                          };
                          
                          const labelLines = splitIntoTwoLines(capitalizedName);
                          const isTwoLines = labelLines.length > 1;
                          
                          const RADIAN = Math.PI / 180;
                          // Point on the outer edge of the pie segment
                          const radius = outerRadius;
                          const xLabel = cx + radius * Math.cos(-midAngle * RADIAN);
                          const yLabel = cy + radius * Math.sin(-midAngle * RADIAN);
                          
                          // Calculate label position (outside the pie with gap)
                          // Use a more conservative label radius to prevent overflow
                          const gap = 10; // Gap between line end and text
                          const labelRadius = outerRadius + 20; // Reduced from 30 to prevent overflow
                          const labelX = cx + (labelRadius + gap) * Math.cos(-midAngle * RADIAN);
                          const labelY = cy + (labelRadius + gap) * Math.sin(-midAngle * RADIAN);
                          
                          // Line end position (before the gap)
                          const lineEndX = cx + labelRadius * Math.cos(-midAngle * RADIAN);
                          const lineEndY = cy + labelRadius * Math.sin(-midAngle * RADIAN);
                          
                          // Determine text anchor based on position
                          const textAnchor = xLabel > cx ? "start" : "end";
                          
                          return (
                            <g>
                              {/* Line from segment edge to label (with gap before text) */}
                              <line
                                x1={xLabel}
                                y1={yLabel}
                                x2={lineEndX}
                                y2={lineEndY}
                                stroke={fill}
                                strokeWidth={1.5}
                              />
                              {/* Label text - reason name (single or two lines) */}
                              {isTwoLines ? (
                                <>
                                  {/* First line */}
                                  <text
                                    x={labelX}
                                    y={labelY}
                                    textAnchor={textAnchor}
                                    fill={fill}
                                    fontSize={14}
                                    fontWeight={500}
                                    dy={-8}
                                  >
                                    {labelLines[0]}
                                  </text>
                                  {/* Second line */}
                                  <text
                                    x={labelX}
                                    y={labelY}
                                    textAnchor={textAnchor}
                                    fill={fill}
                                    fontSize={14}
                                    fontWeight={500}
                                    dy={4}
                                  >
                                    {labelLines[1]}
                                  </text>
                                </>
                              ) : (
                                <text
                                  x={labelX}
                                  y={labelY}
                                  textAnchor={textAnchor}
                                  fill={fill}
                                  fontSize={14}
                                  fontWeight={500}
                                  dy={-8}
                                >
                                  {labelLines[0]}
                                </text>
                              )}
                              {/* Label text - count and percentage */}
                              <text
                                x={labelX}
                                y={labelY}
                                textAnchor={textAnchor}
                                fill={fill}
                                fontSize={13}
                                dy={isTwoLines ? 20 : 8}
                              >
                                {value} ({percentage}%)
                              </text>
                            </g>
                          );
                        }}
                        labelLine={false}
                      >
                        {droppedSalesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* LoB + KAM performance charts (2×2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LoB Existing Sales Performance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>LoB Existing Sales Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lobSalesPerformance.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px] text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={horizontalBarChartHeight(lobSalesPerformance.length, {
                  min: 400,
                  max: 820,
                  perRow: 58,
                })}
              >
              <BarChart
                layout="vertical"
                data={lobSalesPerformance}
                margin={{ top: 40, right: 72, left: 6, bottom: 12 }}
                barCategoryGap="16%"
                barGap={8}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatAxisCurrencyTick(Number(v))}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="lob"
                  width={176}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={(props) => (
                    <ActualVsTargetBarTooltip
                      {...props}
                      targetField="targetMpv"
                      achievedField="achievedMpv"
                    />
                  )}
                  cursor={false}
                />
                <Legend align="right" verticalAlign="top" wrapperStyle={{ fontSize: '12px', paddingBottom: '12px' }} />
                {/* Target bar (grey) */}
                <Bar 
                  dataKey="targetMpv" 
                  fill="#E0E0E0" 
                  name="Target" 
                  barSize={22}
                  radius={[0, 4, 4, 0]}
                  activeBar={false}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="targetMpv"
                    position="right"
                    formatter={(v: number) => formatCurrencyLabel(v)}
                    style={{
                      fill: "hsl(var(--foreground))",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                </Bar>
                {/* Achieved bar (blue) */}
                <Bar 
                  dataKey="achievedMpv" 
                  fill="#4169E1" 
                  name="Achieved" 
                  barSize={22}
                  radius={[0, 4, 4, 0]}
                  activeBar={false}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="achievedMpv"
                    position="right"
                    formatter={(v: number) => formatCurrencyLabel(v)}
                    style={{
                      fill: "hsl(var(--foreground))",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mandates Per LoB</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Active mandates as of end of {dashboardPeriodLabels.targetMcvFooter}, matching the
              Active Mandates card filters.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mandatesPerLobChart.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px] text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={horizontalBarChartHeight(mandatesPerLobChart.length, {
                  min: 400,
                  max: 820,
                  perRow: 58,
                })}
              >
                <BarChart
                  layout="vertical"
                  data={mandatesPerLobChart}
                  margin={{ top: 12, right: 48, left: 6, bottom: 12 }}
                  barCategoryGap="16%"
                >
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickFormatter={(v) => formatNumber(Number(v))}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="lob"
                    width={176}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    content={(props) => (
                      <DashboardSingleMetricTooltip
                        {...props}
                        valueKey="count"
                        label="Active mandates"
                      />
                    )}
                    cursor={false}
                  />
                  <Bar
                    dataKey="count"
                    name="Active mandates"
                    fill="#4169E1"
                    barSize={26}
                    radius={[0, 4, 4, 0]}
                    activeBar={false}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="count"
                      position="right"
                      formatter={(v: number) => formatNumber(Number(v))}
                      style={{
                        fill: "hsl(var(--foreground))",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Max MCV Per LoB</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {dashboardPeriodLabels.isScoped ? (
                <>
                  Sum of achieved MCV for each active mandate in{" "}
                  <span className="font-medium text-foreground">
                    {dashboardPeriodLabels.targetMcvMonthFooter}
                  </span>
                  .
                </>
              ) : (
                <>
                  Sum of each active mandate&apos;s highest monthly achieved MCV within{" "}
                  {formatFYForDisplay(filterFinancialYear)}.
                </>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : maxMcvPerLobChart.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px] text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={horizontalBarChartHeight(maxMcvPerLobChart.length, {
                  min: 400,
                  max: 820,
                  perRow: 58,
                })}
              >
                <BarChart
                  layout="vertical"
                  data={maxMcvPerLobChart}
                  margin={{ top: 12, right: 72, left: 6, bottom: 12 }}
                  barCategoryGap="16%"
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatAxisCurrencyTick(Number(v))}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="lob"
                    width={176}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    content={(props) => (
                      <DashboardSingleMetricTooltip
                        {...props}
                        valueKey="sumMaxMcv"
                        label="Sum of max achieved MCV"
                      />
                    )}
                    cursor={false}
                  />
                  <Bar
                    dataKey="sumMaxMcv"
                    name="Sum of max achieved MCV"
                    fill="#4169E1"
                    barSize={26}
                    radius={[0, 4, 4, 0]}
                    activeBar={false}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="sumMaxMcv"
                      position="right"
                      formatter={(v: number) => formatCurrencyLabel(Number(v))}
                      style={{
                        fill: "hsl(var(--foreground))",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{formatFYForDisplay(filterFinancialYear)} Annual Sales Target - Individual</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Compare target vs achieved sales for individual staff members.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : kamSalesPerformance.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] h-[420px] text-muted-foreground">
                No data available
              </div>
            ) : (
            <ResponsiveContainer
              width="100%"
              height={horizontalBarChartHeight(kamSalesPerformance.length, {
                min: 440,
                max: 920,
                perRow: 50,
              })}
            >
              <BarChart
                layout="vertical"
                data={kamSalesPerformance.map((item) => {
                  const isAchievedGreater = item.achievedMpv > item.targetMpv;
                  const smallerValue = isAchievedGreater ? item.targetMpv : item.achievedMpv;
                  const biggerValue = isAchievedGreater ? item.achievedMpv : item.targetMpv;
                  const difference = biggerValue - smallerValue;
                  
                  return {
                    ...item,
                    base: smallerValue, // Smaller value as base (starts from X-axis)
                    overlay: difference, // Difference stacked on top (bigger - smaller)
                    baseColor: isAchievedGreater ? "#E0E0E0" : "#4169E1", // Grey if Achieved > Target, Blue if Target > Achieved
                    overlayColor: isAchievedGreater ? "#4169E1" : "#E0E0E0", // Blue if Achieved > Target, Grey if Target > Achieved
                    baseName: isAchievedGreater ? "Target" : "Achieved",
                    overlayName: isAchievedGreater ? "Achieved" : "Target",
                  };
                })}
                margin={{ top: 40, right: 16, left: 6, bottom: 12 }}
                barCategoryGap="14%"
                barGap={0}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatAxisCurrencyTick(Number(v))}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="kamName"
                  width={168}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={(props) => (
                    <ActualVsTargetBarTooltip
                      {...props}
                      targetField="targetMpv"
                      achievedField="achievedMpv"
                    />
                  )}
                  cursor={false}
                />
                <Legend 
                  align="right" 
                  verticalAlign="top" 
                  wrapperStyle={{ fontSize: '12px', paddingBottom: '12px' }}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', backgroundColor: '#4169E1', borderRadius: '2px' }}></div>
                          <span style={{ fontSize: '12px' }}>Achieved</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', backgroundColor: '#E0E0E0', borderRadius: '2px' }}></div>
                          <span style={{ fontSize: '12px' }}>Target</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {/* Base bar - smaller value, conditional color */}
                <Bar 
                  dataKey="base" 
                  name="Base"
                  stackId="kam"
                  barSize={28}
                  radius={[0, 0, 0, 0]}
                  activeBar={false}
                  isAnimationActive={false}
                >
                  {kamSalesPerformance.map((item, index) => {
                    const isAchievedGreater = item.achievedMpv > item.targetMpv;
                    const fillColor = isAchievedGreater ? "#E0E0E0" : "#4169E1";
                    return <Cell key={`base-${index}`} fill={fillColor} />;
                  })}
                </Bar>
                {/* Overlay bar - difference, conditional color */}
                <Bar 
                  dataKey="overlay" 
                  name="Overlay"
                  stackId="kam"
                  barSize={28}
                  radius={[0, 4, 4, 0]}
                  activeBar={false}
                  isAnimationActive={false}
                >
                  {kamSalesPerformance.map((item, index) => {
                    const isAchievedGreater = item.achievedMpv > item.targetMpv;
                    const fillColor = isAchievedGreater ? "#4169E1" : "#E0E0E0";
                    return <Cell key={`overlay-${index}`} fill={fillColor} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MCV Tier Table */}
      <Card>
        <CardHeader>
          <CardTitle>MCV Tier</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 min-w-[120px] bg-background border-r">
                      Category
                    </TableHead>
                    <TableHead className="sticky left-[120px] z-30 min-w-[180px] whitespace-nowrap bg-background border-r">
                      Tier
                    </TableHead>
                    <TableHead className="sticky left-[300px] z-30 min-w-[110px] bg-background border-r">
                      Type
                    </TableHead>
                    {tierMonthColumns.map((col) => (
                      <TableHead key={col.key} className="min-w-[100px] whitespace-nowrap">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="sticky right-0 z-20 min-w-[130px] bg-background border-l text-right shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.15)]">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    if (mcvTierData.length === 0) {
                      return (
                        <TableRow>
                          <TableCell
                            colSpan={tierMonthColumns.length + 4}
                            className="text-center text-muted-foreground py-8"
                          >
                            No data available
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return mcvTierData.map((row, idx) => {
                      const lqBalance =
                        row.rowType === "Balance" && typeof row.lastQuarter === "number"
                          ? row.lastQuarter
                          : null;
                      let lqBalanceClass = "";
                      if (lqBalance !== null) {
                        if (lqBalance < 0) lqBalanceClass = "text-green-600 font-medium";
                        else if (lqBalance > 0) lqBalanceClass = "text-red-600 font-medium";
                      }

                      const isTierStartRow = row.rowType === "Target" && idx > 0;
                      const isTierBoundaryRow = row.rowType === "Balance";
                      return (
                        <TableRow
                          key={idx}
                          className={cn(
                            isTierStartRow && "border-t-4 border-t-slate-400 bg-slate-100/30",
                            isTierBoundaryRow && "border-b-4 border-b-slate-400"
                          )}
                        >
                          <TableCell className="sticky left-0 z-10 min-w-[120px] bg-background border-r">
                            {row.category}
                          </TableCell>
                          <TableCell className="sticky left-[120px] z-10 min-w-[180px] whitespace-nowrap bg-background border-r">
                            {row.tier}
                          </TableCell>
                          <TableCell className="sticky left-[300px] z-10 min-w-[110px] bg-background border-r">
                            {row.rowType}
                          </TableCell>
                          {tierMonthColumns.map((col) => {
                            const cellValue = row[col.key];

                            if (row.rowType === "Balance") {
                              const balanceValue =
                                typeof cellValue === "number"
                                  ? cellValue
                                  : parseFloat(cellValue?.toString() || "0") || 0;
                              const isNegative = balanceValue < 0;
                              const isPositive = balanceValue > 0;
                              const displayValue = Math.abs(balanceValue);
                              const formattedValue = formatCurrency(displayValue);

                              const colorClass = isNegative
                                ? "text-green-600 font-medium"
                                : isPositive
                                  ? "text-red-600 font-medium"
                                  : "";

                              return (
                                <TableCell
                                  key={col.key}
                                  className={`min-w-[100px] ${colorClass}`}
                                >
                                  {formattedValue}
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell
                                key={col.key}
                                className="min-w-[100px] whitespace-nowrap"
                              >
                                {cellValue || (row.rowType === "Achievement" ? "0.0%" : "₹0")}
                              </TableCell>
                            );
                          })}
                          <TableCell
                            className={`sticky right-0 z-10 min-w-[130px] border-l bg-background text-right font-medium shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.15)] ${lqBalanceClass}`}
                          >
                            {row.rowType === "Balance" && typeof row.lastQuarter === "number"
                              ? formatCurrency(Math.abs(row.lastQuarter))
                              : (row.lastQuarter as string | undefined) ??
                                (row.rowType === "Achievement" ? "0.0%" : "₹0")}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </CardContent>
      </Card>

      {/* Upsell Section */}
      <Card className="bg-green-100/60">
        <CardContent className="p-6 space-y-6">
      {/* MCV Tier Filter for Upsell Sections */}
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium">Filter by MCV Tier:</label>
        <Select value={upsellMcvTierFilter} onValueChange={setUpsellMcvTierFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select MCV Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All MCV Tiers">All MCV Tiers</SelectItem>
            <SelectItem value="MCV Tier 1">MCV Tier 1</SelectItem>
            <SelectItem value="MCV Tier 2">MCV Tier 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Upsell Tables - Group B and Group C */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Upsell - For Status Checking (Group B)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Upsell Status</TableHead>
                  <TableHead>Count of Mandate</TableHead>
                  <TableHead>Sum of Revenue</TableHead>
                  <TableHead>Count of Account (Unique)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : upsellGroupB.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  upsellGroupB.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{formatNumber(row.count)}</TableCell>
                      <TableCell>{row.revenue}</TableCell>
                      <TableCell>{formatNumber(row.accounts)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upsell - For Status Checking (Group C)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Upsell Status</TableHead>
                  <TableHead>Count of Mandate</TableHead>
                  <TableHead>Sum of Revenue</TableHead>
                  <TableHead>Count of Account (Unique)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : upsellGroupC.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  upsellGroupC.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{formatNumber(row.count)}</TableCell>
                      <TableCell>{row.revenue}</TableCell>
                      <TableCell>{formatNumber(row.accounts)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Upsell Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Upsell Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Prev Month (Count of Mandate)</TableHead>
                <TableHead>Current Month (Count of Mandate)</TableHead>
                <TableHead className="border-r">Difference</TableHead>
                <TableHead>Prev Month (Sum of Revenue)</TableHead>
                <TableHead>Current Month (Sum of Revenue)</TableHead>
                <TableHead className="border-r">Difference</TableHead>
                <TableHead>Prev Month (Unique Accounts)</TableHead>
                <TableHead>Current Month (Unique Accounts)</TableHead>
                <TableHead>Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : upsellPerformance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                upsellPerformance.map((row, idx) => {
                  const getDiffColor = (numValue: number) => {
                    if (numValue > 0) return "text-green-600 font-semibold";
                    if (numValue < 0) return "text-red-600 font-semibold";
                    return "text-yellow-600 font-semibold";
                  };

                  const countDiffNum = row.currCount - row.prevCount;
                  const accDiffNum = row.currAcc - row.prevAcc;

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.group}</TableCell>
                      <TableCell>{row.prevCount}</TableCell>
                      <TableCell>{row.currCount}</TableCell>
                      <TableCell className={`${getDiffColor(countDiffNum)} border-r`}>{row.countDiff}</TableCell>
                      <TableCell>{row.prevRev}</TableCell>
                      <TableCell>{row.currRev}</TableCell>
                      <TableCell className={`${getDiffColor(row.revDiffNumeric)} border-r`}>{row.revDiff}</TableCell>
                      <TableCell>{row.prevAcc}</TableCell>
                      <TableCell>{row.currAcc}</TableCell>
                      <TableCell className={getDiffColor(accDiffNum)}>{row.accDiff}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </CardContent>
      </Card>

      {/* PDF Guide Dialog */}
      <PDFGuideDialog
        open={guideDialogOpen}
        onOpenChange={setGuideDialogOpen}
        pdfPath="/Guide.pdf"
        startPage={3}
      />
        </div>
  );
}
