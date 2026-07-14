import type { SupabaseClient } from "@supabase/supabase-js";
import { expandDashboardLobFilterValues } from "@/lib/teamLob";
import {
  applyExcludeTestKamFilter,
  filterRowsByTestProfiles,
  type TestProfileExclusions,
} from "@/lib/dashboardTestAccounts";

export const DASHBOARD_RAW_CACHE_PAGE = "dashboard-raw";
export const DASHBOARD_DERIVED_CACHE_PAGE = "dashboard-v2";

export type DashboardMandateRow = {
  id: string;
  team?: string | null;
  lob?: string | null;
  type?: string | null;
  kam_id?: string | null;
  new_sales_owner?: string | null;
  account_id?: string | null;
  created_at?: string | null;
  lifecycle_status?: string | null;
  lifecycle_status_log?: unknown;
  monthly_data?: unknown;
  awign_share_percent?: string | null;
  retention_type?: string | null;
  upsell_action_status?: string | null;
  revenue_mcv?: number | string | null;
};

export type DashboardRawPayload = {
  mandates: DashboardMandateRow[];
  inactiveLifecycleRows: Array<{
    id: string;
    monthly_data?: unknown;
    lob?: string | null;
  }>;
  accounts: Array<{
    id: string;
    mcv_tier?: string | null;
    company_size_tier?: string | null;
  }>;
  managerTargets: Array<{
    month: number;
    year: number;
    existing_target?: number | string | null;
    new_ac_target?: number | string | null;
    team?: string | null;
  }>;
  monthlyTargets: any[];
  allKams: Array<{ id: string; full_name: string | null }>;
  droppedDeals: Array<{ dropped_reason: string | null; account_id: string | null }>;
  testExclusions: TestProfileExclusions;
};

const PAGE_SIZE = 1000;

/** Paginate until all rows are loaded (avoids silent 1000-row truncation). */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildPage(from, to);
    if (error) return { data: all, error };
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: all, error: null };
}

export function mandateMatchesStatus(
  type: string | null | undefined,
  statusFilter: string,
  nsoFilterActive: boolean,
): boolean {
  if (nsoFilterActive) return true;
  if (statusFilter === "all" || statusFilter === "All mandate types") return true;
  if (statusFilter === "Existing") return type === "Existing";
  if (statusFilter === "All Cross Sell") return type === "New Cross Sell";
  if (statusFilter === "All Cross Sell + Existing") {
    return type === "New Cross Sell" || type === "Existing";
  }
  if (statusFilter === "New Acquisitions") return type === "New Acquisition";
  return true;
}

export function mandateMatchesKamNso(
  mandate: {
    kam_id?: string | null;
    type?: string | null;
    new_sales_owner?: string | null;
  },
  opts: {
    isKAM: boolean;
    userId?: string | null;
    filterKam: string;
    filterNso: string;
    isKamFilterActive: (kam: string) => boolean;
    isNsoFilterActive: (nso: string) => boolean;
  },
): boolean {
  if (opts.isKAM && opts.userId) {
    if (mandate.kam_id !== opts.userId) return false;
  } else if (opts.isKamFilterActive(opts.filterKam)) {
    if (mandate.kam_id !== opts.filterKam) return false;
  }
  if (opts.isNsoFilterActive(opts.filterNso)) {
    if (mandate.type !== "New Acquisition") return false;
    if (mandate.new_sales_owner !== opts.filterNso) return false;
  }
  return true;
}

export function mandateMatchesLob(
  lob: string | null | undefined,
  selectedLobs: string[],
): boolean {
  if (selectedLobs.length === 0) return true;
  const expanded = expandDashboardLobFilterValues(selectedLobs);
  return !!lob && expanded.includes(lob);
}

export function filterDashboardMandates(
  mandates: DashboardMandateRow[],
  opts: {
    applyStatus: boolean;
    applyKamNso: boolean;
    applyLob: boolean;
    statusFilter: string;
    nsoFilterActive: boolean;
    selectedLobs: string[];
    createdAtLte?: Date | null;
    createdAtGte?: Date | null;
    retentionType?: string | null;
    requireAccountId?: boolean;
    requireAwignShare?: boolean;
    isKAM: boolean;
    userId?: string | null;
    filterKam: string;
    filterNso: string;
    isKamFilterActive: (kam: string) => boolean;
    isNsoFilterActive: (nso: string) => boolean;
  },
): DashboardMandateRow[] {
  return mandates.filter((m) => {
    if (opts.retentionType && m.retention_type !== opts.retentionType) return false;
    if (opts.requireAccountId && !m.account_id) return false;
    if (opts.requireAwignShare && m.awign_share_percent == null) return false;
    if (opts.createdAtLte) {
      if (
        !m.created_at ||
        new Date(m.created_at).getTime() > opts.createdAtLte.getTime()
      ) {
        return false;
      }
    }
    if (opts.createdAtGte) {
      if (
        !m.created_at ||
        new Date(m.created_at).getTime() < opts.createdAtGte.getTime()
      ) {
        return false;
      }
    }
    if (opts.applyStatus) {
      if (!mandateMatchesStatus(m.type, opts.statusFilter, opts.nsoFilterActive)) {
        return false;
      }
    }
    if (opts.applyKamNso) {
      if (
        !mandateMatchesKamNso(m, {
          isKAM: opts.isKAM,
          userId: opts.userId,
          filterKam: opts.filterKam,
          filterNso: opts.filterNso,
          isKamFilterActive: opts.isKamFilterActive,
          isNsoFilterActive: opts.isNsoFilterActive,
        })
      ) {
        return false;
      }
    }
    if (opts.applyLob && !mandateMatchesLob(m.lob, opts.selectedLobs)) {
      return false;
    }
    return true;
  });
}

type FetchRawArgs = {
  supabase: SupabaseClient<any>;
  selectedTeam: string;
  fyStartYear: number;
  fyEndYear: number;
  financialYearString: string | null;
  isKAM: boolean;
  userId?: string | null;
  testExclusions: TestProfileExclusions;
};

/**
 * Team + FY scoped payload (no KAM/NSO/LoB/status/month filters).
 * Person/LoB/status/month are applied client-side from this cache.
 */
export async function fetchDashboardRawPayload(
  args: FetchRawArgs,
): Promise<{ data: DashboardRawPayload | null; error: any }> {
  const {
    supabase,
    selectedTeam,
    fyStartYear,
    fyEndYear,
    financialYearString,
    isKAM,
    userId,
    testExclusions,
  } = args;

  const applyTeam = (query: any) => {
    if (!selectedTeam || selectedTeam === "all") return query;
    return query.eq("team", selectedTeam);
  };
  const withExcluded = (query: any, column = "kam_id") =>
    applyExcludeTestKamFilter(query, testExclusions.kamIds, column);

  let mandatesBase = () => {
    let q = applyTeam(
      supabase
        .from("mandates")
        .select(
          "id, team, lob, type, kam_id, new_sales_owner, account_id, created_at, lifecycle_status, lifecycle_status_log, monthly_data, awign_share_percent, retention_type, upsell_action_status, revenue_mcv",
        ),
    );
    q = withExcluded(q);
    if (isKAM && userId) {
      q = q.eq("kam_id", userId);
    }
    return q;
  };

  let inactiveBase = () => {
    let q = applyTeam(
      supabase
        .from("mandates")
        .select("id, monthly_data, lob")
        .eq("lifecycle_status", "Inactive"),
    );
    q = withExcluded(q);
    if (isKAM && userId) {
      q = q.eq("kam_id", userId);
    }
    return q;
  };

  let targetsBase = () => {
    let q = supabase
      .from("monthly_targets")
      .select(
        "target, month, year, mandate_id, account_id, kam_id, nso_mail_id, target_type, financial_year, mandates(id, lob, kam_id, type, account_id, new_sales_owner, team)",
      )
      .in("target_type", ["existing", "new_cross_sell"]);
    if (financialYearString) {
      q = q.eq("financial_year", financialYearString);
    }
    // Do NOT filter by mandates.team here: several dashboard paths (cross-sell,
    // tier targets) intentionally omit that server filter. Team/KAM scope is
    // applied client-side via mandate ID sets / filterTargetsByKamNso.
    q = withExcluded(q);
    return q;
  };

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

  const [
    mandatesResult,
    inactiveResult,
    accountsResult,
    managerTargetsResult,
    monthlyTargetsResult,
    allKamsResult,
  ] = await Promise.all([
    fetchAllRows<DashboardMandateRow>((from, to) =>
      mandatesBase().range(from, to),
    ),
    fetchAllRows<{
      id: string;
      monthly_data?: unknown;
      lob?: string | null;
    }>((from, to) => inactiveBase().range(from, to)),
    supabase.from("accounts").select("id, mcv_tier, company_size_tier"),
    supabase
      .from("manager_targets")
      .select("month, year, existing_target, new_ac_target, team")
      .in("team", selectedTeam === "all" ? ["ce", "staffing", "experts"] : [selectedTeam])
      .in("year", [fyStartYear, fyEndYear]),
    fetchAllRows((from, to) => targetsBase().range(from, to)),
    allKamsQuery,
  ]);

  if (mandatesResult.error) return { data: null, error: mandatesResult.error };
  if (inactiveResult.error) return { data: null, error: inactiveResult.error };
  if (accountsResult.error) return { data: null, error: accountsResult.error };
  if (managerTargetsResult.error) {
    return { data: null, error: managerTargetsResult.error };
  }
  if (monthlyTargetsResult.error) {
    return { data: null, error: monthlyTargetsResult.error };
  }
  if (allKamsResult.error) return { data: null, error: allKamsResult.error };

  const mandates = filterRowsByTestProfiles(
    mandatesResult.data,
    testExclusions,
  ) as DashboardMandateRow[];

  const accountIds = [
    ...new Set(mandates.map((m) => m.account_id).filter(Boolean) as string[]),
  ];

  let droppedDeals: DashboardRawPayload["droppedDeals"] = [];
  if (accountIds.length > 0) {
    const droppedChunks: DashboardRawPayload["droppedDeals"] = [];
    const ID_CHUNK = 120;
    for (let i = 0; i < accountIds.length; i += ID_CHUNK) {
      const idChunk = accountIds.slice(i, i + ID_CHUNK);
      const { data, error } = await withExcluded(
        supabase
          .from("pipeline_deals")
          .select("dropped_reason, account_id")
          .eq("status", "Dropped")
          .not("dropped_reason", "is", null)
          .in("account_id", idChunk),
      );
      if (error) return { data: null, error };
      droppedChunks.push(...(data ?? []));
    }
    droppedDeals = droppedChunks;
  }

  return {
    data: {
      mandates,
      inactiveLifecycleRows: inactiveResult.data ?? [],
      accounts: accountsResult.data ?? [],
      managerTargets: (managerTargetsResult.data as DashboardRawPayload["managerTargets"]) ?? [],
      monthlyTargets: filterRowsByTestProfiles(
        monthlyTargetsResult.data,
        testExclusions,
      ),
      allKams: allKamsResult.data ?? [],
      droppedDeals,
      testExclusions,
    },
    error: null,
  };
}
