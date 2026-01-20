import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BookOpen } from "lucide-react";
import { PDFGuideDialog } from "@/components/PDFGuideDialog";

// All LoB options
const lobOptions = [
  "Diligence & Audit",
  "New Business Development",
  "Digital Gigs",
  "Awign Expert",
  "Last Mile Operations",
  "Invigilation & Proctoring",
  "Staffing",
  "Others",
];

// Helper function to extract achieved MCV from monthly_data
// Handles both old format (array: [plannedMcv, achievedMcv]) and new format (number: achievedMcv)
const getAchievedMcv = (monthRecord: any): number => {
  if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
    // Old format: [plannedMcv, achievedMcv]
    return parseFloat(monthRecord[1]?.toString() || "0") || 0;
  } else if (typeof monthRecord === 'number') {
    // New format: just achievedMcv
    return monthRecord;
  }
  return 0;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [totalMandates, setTotalMandates] = useState(0);
  const [mandatesThisMonth, setMandatesThisMonth] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [avgAwignShare, setAvgAwignShare] = useState<number | null>(null);
  const [overlapFactor, setOverlapFactor] = useState<number | null>(null);
  const [mcvPlanned, setMcvPlanned] = useState<number>(0);
  const [ffmAchieved, setFfmAchieved] = useState<number>(0);
  const [ffmAchievedFyPercentage, setFfmAchievedFyPercentage] = useState<number>(0);
  const [mcvThisQuarter, setMcvThisQuarter] = useState<number>(0);
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
    [key: string]: string | number;
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
  // Filter states
  const [filterFinancialYear, setFilterFinancialYear] = useState<string>(() => {
    // Calculate current financial year on component mount
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Financial year starts in April (month 4)
    // If current month is April or later, FY started in current year
    // If current month is Jan-Mar, FY started in previous year
    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    
    // Convert to 2-digit format (e.g., 2025 -> 25)
    const fyYearDigits = fyStartYear.toString().slice(-2);
    
    return `FY${fyYearDigits}`;
  });
  const [filterUpsellStatus, setFilterUpsellStatus] = useState<string>("All Cross Sell + Existing");
  const [filterKam, setFilterKam] = useState<string>("");
  const [kams, setKams] = useState<Array<{ id: string; full_name: string }>>([]);
  const [kamSearch, setKamSearch] = useState("");
  const [guideDialogOpen, setGuideDialogOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchKams();
  }, [filterFinancialYear, filterUpsellStatus, filterKam]);

  // Helper function to get current financial year in FY format (e.g., "FY25")
  const getCurrentFinancialYear = (): string => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Financial year starts in April (month 4)
    // If current month is April or later, FY started in current year
    // If current month is Jan-Mar, FY started in previous year
    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    
    // Convert to 2-digit format (e.g., 2025 -> 25)
    const fyYearDigits = fyStartYear.toString().slice(-2);
    
    return `FY${fyYearDigits}`;
  };

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

  // Helper function to apply status filter to a Supabase query
  const applyStatusFilter = (query: any, statusFilter: string): any => {
    if (statusFilter === "all") {
      return query; // No filter applied
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

  // Helper function to apply KAM filter to a Supabase query
  const applyKamFilter = (query: any, kamFilter: string): any => {
    if (!kamFilter || kamFilter === "") {
      return query; // No filter applied
    }
    return query.eq("kam_id", kamFilter);
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

  // Process Group B upsell data with MCV tier filter applied client-side
  const processedUpsellGroupB = useMemo(() => {
    const filteredGroupBMandates = filterMandatesByMcvTier(rawGroupBMandates, accountMcvTierMapState);
    
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
  }, [rawGroupBMandates, accountMcvTierMapState, upsellMcvTierFilter]);

  // Process Group C upsell data with MCV tier filter applied client-side
  const processedUpsellGroupC = useMemo(() => {
    const filteredGroupCMandates = filterMandatesByMcvTier(rawGroupCMandates, accountMcvTierMapState);
    
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
  }, [rawGroupCMandates, accountMcvTierMapState, upsellMcvTierFilter]);

  // Process upsell performance data with MCV tier filter applied client-side
  const processedUpsellPerformance = useMemo(() => {
    const filteredAllMandates = filterMandatesByMcvTier(rawAllMandates, accountMcvTierMapState);
    
    // Get current month and previous month dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Get unique retention types (include null as "Not Set")
    const retentionTypes = [...new Set((filteredAllMandates || []).map((m: any) => m.retention_type || "Not Set"))].sort();

    // Process upsell performance data for each retention type
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
      // Previous month data
      const prevMonthMandates = (filteredAllMandates || []).filter((m: any) => {
        const createdDate = new Date(m.created_at);
        const mandateRetentionType = m.retention_type || "Not Set";
        return mandateRetentionType === retentionType &&
               createdDate >= prevMonthStart &&
               createdDate <= prevMonthEnd;
      });

      // Current month data
      const currMonthMandates = (filteredAllMandates || []).filter((m: any) => {
        const createdDate = new Date(m.created_at);
        const mandateRetentionType = m.retention_type || "Not Set";
        return mandateRetentionType === retentionType &&
               createdDate >= startOfMonth &&
               createdDate <= endOfMonth;
      });

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

    // Format performance data for display
    const formatRevenue = (value: number): string => {
      if (value === 0) return "₹0";
      const inLakhs = value / 100000;
      if (inLakhs >= 1) {
        return `₹${inLakhs.toFixed(1)}L`;
      }
      return `₹${Math.round(value).toLocaleString("en-IN")}`;
    };

    const formatDiff = (curr: number, prev: number): string => {
      const diff = curr - prev;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    };

    return [
      ...performanceData.map((d) => ({
        group: d.group,
        prevCount: d.prevCount,
        currCount: d.currCount,
        countDiff: formatDiff(d.currCount, d.prevCount),
        prevRev: formatRevenue(d.prevRev),
        currRev: formatRevenue(d.currRev),
        revDiff: formatDiff(d.currRev, d.prevRev),
        prevAcc: d.prevAcc.size,
        currAcc: d.currAcc.size,
        accDiff: formatDiff(d.currAcc.size, d.prevAcc.size),
      })),
      {
        group: "Total",
        prevCount: totalPrevCount,
        currCount: totalCurrCount,
        countDiff: formatDiff(totalCurrCount, totalPrevCount),
        prevRev: formatRevenue(totalPrevRev),
        currRev: formatRevenue(totalCurrRev),
        revDiff: formatDiff(totalCurrRev, totalPrevRev),
        prevAcc: totalPrevAccSet.size,
        currAcc: totalCurrAccSet.size,
        accDiff: formatDiff(totalCurrAccSet.size, totalPrevAccSet.size),
      },
    ];
  }, [rawAllMandates, accountMcvTierMapState, upsellMcvTierFilter]);

  // Update state when processed data changes
  useEffect(() => {
    setUpsellGroupB(processedUpsellGroupB);
    setUpsellGroupC(processedUpsellGroupC);
    setUpsellPerformance(processedUpsellPerformance);
  }, [processedUpsellGroupB, processedUpsellGroupC, processedUpsellPerformance]);

  // Helper function to get current financial year quarter
  const getCurrentFinancialYearQuarter = (): string => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Financial year quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
    if (currentMonth >= 4 && currentMonth <= 6) {
      return "Q1";
    } else if (currentMonth >= 7 && currentMonth <= 9) {
      return "Q2";
    } else if (currentMonth >= 10 && currentMonth <= 12) {
      return "Q3";
    } else {
      return "Q4";
    }
  };

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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "kam")
        .not("full_name", "is", null)
        .order("full_name", { ascending: true });

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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
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
      
      // Get current month start and end dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Get previous month start and end dates
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      // Fetch total mandates count filtered by status and financial year
      let mandatesCountQuery = supabase
        .from("mandates")
        .select("*", { count: "exact", head: true });
      
      // Apply status filter
      mandatesCountQuery = applyStatusFilter(mandatesCountQuery, filterUpsellStatus);
      
      // Apply KAM filter
      mandatesCountQuery = applyKamFilter(mandatesCountQuery, filterKam);
      
      // Filter by created_at within selected financial year
      mandatesCountQuery = mandatesCountQuery
        .gte("created_at", fyDateRange.start.toISOString())
        .lte("created_at", fyDateRange.end.toISOString());
      
      const { count: totalCount, error: totalError } = await mandatesCountQuery;

      if (totalError) throw totalError;

      // Fetch mandates created this month
      let monthCountQuery = supabase
        .from("mandates")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString());
      
      // Apply KAM filter
      monthCountQuery = applyKamFilter(monthCountQuery, filterKam);
      
      const { count: monthCount, error: monthError } = await monthCountQuery;

      if (monthError) throw monthError;

      // Fetch accounts count filtered by KAM and status filters
      // Get unique account IDs from mandates that match the filters
      let accountsQuery = supabase
        .from("mandates")
        .select("account_id");
      
      // Apply status filter
      accountsQuery = applyStatusFilter(accountsQuery, filterUpsellStatus);
      
      // Apply KAM filter
      accountsQuery = applyKamFilter(accountsQuery, filterKam);
      
      // Filter by created_at within selected financial year
      accountsQuery = accountsQuery
        .gte("created_at", fyDateRange.start.toISOString())
        .lte("created_at", fyDateRange.end.toISOString())
        .not("account_id", "is", null);
      
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
      let mandatesDataQuery = supabase
        .from("mandates")
        .select("awign_share_percent")
        .not("awign_share_percent", "is", null);
      
      // Apply KAM filter
      mandatesDataQuery = applyKamFilter(mandatesDataQuery, filterKam);
      
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

      // Calculate Overlap Factor (Mandates / Accounts)
      const overlap = accountsCount && accountsCount > 0 
        ? (totalCount || 0) / accountsCount 
        : null;

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


      // Fetch mandates with retention_type = "B" for Group B upsell data
      let groupBMandatesQuery = supabase
        .from("mandates")
        .select("upsell_action_status, revenue_mcv, account_id")
        .eq("retention_type", "B");
      
      // Apply status filter
      groupBMandatesQuery = applyStatusFilter(groupBMandatesQuery, filterUpsellStatus);
      
      // Apply KAM filter
      groupBMandatesQuery = applyKamFilter(groupBMandatesQuery, filterKam);
      
      // Apply FY filter
      groupBMandatesQuery = groupBMandatesQuery
        .gte("created_at", fyDateRange.start.toISOString())
        .lte("created_at", fyDateRange.end.toISOString());
      
      const { data: groupBMandates, error: groupBError } = await groupBMandatesQuery;

      if (groupBError) throw groupBError;

      // Store raw data for client-side filtering
      setRawGroupBMandates(groupBMandates || []);

      // Fetch mandates with retention_type = "C" for Group C upsell data
      let groupCMandatesQuery = supabase
        .from("mandates")
        .select("upsell_action_status, revenue_mcv, account_id")
        .eq("retention_type", "C");
      
      // Apply status filter
      groupCMandatesQuery = applyStatusFilter(groupCMandatesQuery, filterUpsellStatus);
      
      // Apply KAM filter
      groupCMandatesQuery = applyKamFilter(groupCMandatesQuery, filterKam);
      
      // Apply FY filter
      groupCMandatesQuery = groupCMandatesQuery
        .gte("created_at", fyDateRange.start.toISOString())
        .lte("created_at", fyDateRange.end.toISOString());
      
      const { data: groupCMandates, error: groupCError } = await groupCMandatesQuery;

      if (groupCError) throw groupCError;

      // Store raw data for client-side filtering
      setRawGroupCMandates(groupCMandates || []);

      // Fetch all unique retention types for upsell performance
      // Include all mandates, even those with null retention_type
      let allMandatesQuery = supabase
        .from("mandates")
        .select("retention_type, revenue_mcv, account_id, created_at, type, kam_id");
      
      // Apply status filter
      allMandatesQuery = applyStatusFilter(allMandatesQuery, filterUpsellStatus);
      
      // Apply KAM filter
      allMandatesQuery = applyKamFilter(allMandatesQuery, filterKam);
      
      // Apply FY filter
      allMandatesQuery = allMandatesQuery
        .gte("created_at", fyDateRange.start.toISOString())
        .lte("created_at", fyDateRange.end.toISOString());
      
      const { data: allMandates, error: allMandatesError } = await allMandatesQuery;

      if (allMandatesError) throw allMandatesError;

      // Store raw data for client-side filtering
      setRawAllMandates(allMandates || []);
      setAccountMcvTierMapState(accountMcvTierMap || {});

      // Fetch LoB Sales Performance data from mandates monthly records
      // Apply status filter to only consider mandates with the selected status
      let lobMandatesQuery = supabase
        .from("mandates")
        .select("lob, monthly_data, type");
      lobMandatesQuery = applyStatusFilter(lobMandatesQuery, filterUpsellStatus);
      lobMandatesQuery = applyKamFilter(lobMandatesQuery, filterKam);
      const { data: lobMandatesData, error: lobMandatesError } = await lobMandatesQuery;

      // Initialize all LoBs from the mandate form with 0 values
      // Always show all 8 LoBs from the mandate form, regardless of database records
      const lobData: Record<string, { targetMpv: number; achievedMpv: number }> = {};
      lobOptions.forEach((lob) => {
        lobData[lob] = { targetMpv: 0, achievedMpv: 0 };
      });

      if (!lobMandatesError && lobMandatesData && lobMandatesData.length > 0) {
        // Process monthly records from each mandate
        lobMandatesData.forEach((mandate: any) => {
          const lob = mandate.lob;
          if (lob && lob.trim() !== "" && lobData[lob]) {
            // monthly_data is a JSONB object where:
            // Key: month_year (format: "YYYY-MM", e.g., "2025-01")
            // Value: Array [plannedMcv, achievedMcv]
            const monthlyData = mandate.monthly_data;
            
            // Check if monthly_data exists and is an object
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              // Sum up all monthly records for this mandate within selected FY
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                  // Check if this month falls within the selected financial year
                  const [yearStr, monthStr] = monthYear.split('-');
                  const year = parseInt(yearStr);
                  const month = parseInt(monthStr);
                  const monthDate = new Date(year, month - 1, 1);
                  
                  // Only include if within selected FY date range
                  if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
                    const plannedMcv = parseFloat(monthRecord[0]?.toString() || "0") || 0;
                    const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                    
                    // Target MPV is sum of planned MCV
                    lobData[lob].targetMpv += plannedMcv;
                    
                    // Achieved MPV is sum of achieved MCV
                    lobData[lob].achievedMpv += achievedMcv;
                  }
                }
              });
            }
          }
        });
      }

      // Convert to array with all 8 LoBs from the mandate form, maintaining the exact order
      const formattedLobData = lobOptions.map((lob) => ({
        lob,
        targetMpv: lobData[lob]?.targetMpv || 0,
        achievedMpv: lobData[lob]?.achievedMpv || 0,
      }));

      // Debug: Log the calculated data to verify values
      console.log("LoB Sales Performance - Calculated Values:", formattedLobData);

      setLobSalesPerformance(formattedLobData);

      // Fetch KAM Sales Performance data from mandates monthly records
      // Apply status filter to only consider mandates with the selected status
      let kamMandatesQuery = supabase
        .from("mandates")
        .select("kam_id, monthly_data, type");
      kamMandatesQuery = applyStatusFilter(kamMandatesQuery, filterUpsellStatus);
      kamMandatesQuery = applyKamFilter(kamMandatesQuery, filterKam);
      const { data: kamMandatesData, error: kamMandatesError } = await kamMandatesQuery;

      // Fetch all KAMs to get their names (only profiles with role = 'kam')
      const { data: allKamsData, error: allKamsError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam")
        .not("full_name", "is", null)
        .order("full_name", { ascending: true });

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

      if (!kamMandatesError && kamMandatesData && kamMandatesData.length > 0) {
        // Process monthly records from each mandate grouped by KAM
        kamMandatesData.forEach((mandate: any) => {
          const kamId = mandate.kam_id;
          if (kamId && kamData[kamId]) {
            const monthlyData = mandate.monthly_data;
            
            // Check if monthly_data exists and is an object
            if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
              // Sum up all monthly records for this mandate within selected FY
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                  // Check if this month falls within the selected financial year
                  const [yearStr, monthStr] = monthYear.split('-');
                  const year = parseInt(yearStr);
                  const month = parseInt(monthStr);
                  const monthDate = new Date(year, month - 1, 1);
                  
                  // Only include if within selected FY date range
                  if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
                    const plannedMcv = parseFloat(monthRecord[0]?.toString() || "0") || 0;
                    const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                    
                    // Target MPV is sum of planned MCV
                    kamData[kamId].targetMpv += plannedMcv;
                    
                    // Achieved MPV is sum of achieved MCV
                    kamData[kamId].achievedMpv += achievedMcv;
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

      // Calculate MCV Planned from monthly_targets table for current month
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();
      const currentMonthYear = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      let totalMcvPlanned = 0;
      let totalFfmAchieved = 0;

      // Fetch MCV Planned from monthly_targets table for current month within selected FY
      // Sum all targets for the current month (there may be multiple targets with different types)
      // For KAM filtering: new_cross_sell targets have kam_id directly, existing targets have kam_id via mandate
      // We also need to filter by mandate type to ensure targets match the selected mandate type filter
      let query = supabase
        .from("monthly_targets")
        .select("target, month, year, financial_year, target_type, kam_id, mandate_id, mandates(kam_id, type)")
        .eq("month", currentMonth)
        .eq("year", currentYear);
      
      // Filter by financial_year if available - this is REQUIRED to avoid showing wrong targets
      if (financialYearString) {
        query = query.eq("financial_year", financialYearString);
      } else {
        // If no financial year is selected, don't show any targets to avoid confusion
        // Set query to return no results
        query = query.eq("financial_year", "nonexistent_fy_to_return_no_results");
      }
      
      // Don't apply target_type filter at query level - we'll filter by both target_type AND mandate.type client-side
      // This ensures we only show targets for mandates with the correct type
      // query = applyTargetTypeFilter(query, filterUpsellStatus);
      
      const { data: allTargets, error: targetsError } = await query;
      
      // Apply mandate type filter and KAM filter client-side
      // We filter by both target_type AND mandate.type to ensure correct filtering
      let currentMonthTargets = allTargets;
      if (allTargets) {
        currentMonthTargets = allTargets.filter((target: any) => {
          // Get mandate object (handle both array and single object)
          const mandate = target.mandate_id 
            ? (Array.isArray(target.mandates) ? target.mandates[0] : target.mandates)
            : null;
          
          // Debug: Log target details for troubleshooting
          const targetType = target.target_type;
          const mandateType = mandate?.type;
          
          // Filter by mandate type based on filterUpsellStatus
          let shouldInclude = false;
          
          if (filterUpsellStatus === "Existing") {
            // Only include targets for mandates with type = 'Existing'
            // Must be target_type='existing' AND mandate.type='Existing'
            if (targetType === 'existing' && target.mandate_id && mandate) {
              if (mandateType === 'Existing') {
                shouldInclude = true;
              }
            }
          } else if (filterUpsellStatus === "All Cross Sell") {
            // Include:
            // 1. Targets with target_type = 'new_cross_sell' (account-based targets)
            // 2. Targets with target_type = 'existing' linked to mandates with type = 'New Cross Sell'
            if (targetType === 'new_cross_sell') {
              shouldInclude = true;
            } else if (targetType === 'existing' && target.mandate_id && mandate) {
              if (mandateType === 'New Cross Sell') {
                shouldInclude = true;
              }
            }
          } else if (filterUpsellStatus === "All Cross Sell + Existing") {
            // Include:
            // 1. Targets with target_type = 'new_cross_sell' (account-based targets)
            // 2. Targets with target_type = 'existing' linked to mandates with type = 'Existing'
            // 3. Targets with target_type = 'existing' linked to mandates with type = 'New Cross Sell'
            if (targetType === 'new_cross_sell') {
              shouldInclude = true;
            } else if (targetType === 'existing' && target.mandate_id && mandate) {
              if (mandateType === 'Existing' || mandateType === 'New Cross Sell') {
                shouldInclude = true;
              }
            }
          } else if (filterUpsellStatus === "New Acquisitions") {
            // New Acquisitions typically don't have targets
            // Only include if target_type='existing' AND mandate.type='New Acquisition'
            if (targetType === 'existing' && target.mandate_id && mandate) {
              if (mandateType === 'New Acquisition') {
                shouldInclude = true;
              }
            }
          } else {
            // For other status filters, include all targets
            shouldInclude = true;
          }
          
          if (!shouldInclude) {
            return false;
          }
          
          // Apply KAM filter
          if (filterKam && filterKam !== "") {
            // For new_cross_sell targets: check monthly_targets.kam_id directly
            if (targetType === 'new_cross_sell') {
              if (target.kam_id === filterKam) {
                return true;
              } else {
                return false;
              }
            }
            // For existing targets: check mandate's kam_id
            if (targetType === 'existing' && target.mandate_id && mandate) {
              if (mandate.kam_id === filterKam) {
                return true;
              } else {
                return false;
              }
            }
            return false; // KAM doesn't match
          }
          
          return true; // No KAM filter, include this target
        });
      }

      if (targetsError) {
        console.error("Error fetching monthly targets for MCV Planned:", targetsError);
      }

      console.log(`MCV Planned Query: Looking for month=${currentMonth}, year=${currentYear}, financial_year=${financialYearString || 'NONE SELECTED'}, statusFilter=${filterUpsellStatus}, kamFilter=${filterKam || 'ALL KAMs'}`);
      console.log(`MCV Planned - All targets from query (before client-side filter):`, allTargets);
      console.log(`MCV Planned - Filtered targets (after client-side filter):`, currentMonthTargets);
      console.log(`MCV Planned - Filter details:`, {
        filterUpsellStatus,
        allTargetsCount: allTargets?.length || 0,
        filteredTargetsCount: currentMonthTargets?.length || 0,
        targetTypes: allTargets?.map((t: any) => {
          const m = t.mandate_id ? (Array.isArray(t.mandates) ? t.mandates[0] : t.mandates) : null;
          return {
            target_type: t.target_type,
            target_value: t.target,
            mandate_id: t.mandate_id,
            mandate_type: m?.type,
            kam_id: t.kam_id,
            mandate_kam_id: m?.kam_id
          };
        }),
        filteredTargets: currentMonthTargets?.map((t: any) => {
          const m = t.mandate_id ? (Array.isArray(t.mandates) ? t.mandates[0] : t.mandates) : null;
          return {
            target_type: t.target_type,
            target_value: t.target,
            mandate_id: t.mandate_id,
            mandate_type: m?.type
          };
        })
      });
      
      // Debug: Also fetch all targets for current month to see what's in the DB (for debugging only)
      const { data: allCurrentMonthTargets } = await supabase
        .from("monthly_targets")
        .select("target, month, year, financial_year, target_type, mandate_id, account_id, kam_id")
        .eq("month", currentMonth)
        .eq("year", currentYear);
      console.log(`[DEBUG] All targets for current month (${currentMonth}/${currentYear}) in database:`, allCurrentMonthTargets);
      if (allCurrentMonthTargets && allCurrentMonthTargets.length > 0) {
        console.log(`[DEBUG] Found ${allCurrentMonthTargets.length} target(s) in DB for current month. Financial years:`, 
          allCurrentMonthTargets.map(t => t.financial_year));
      }

      if (!targetsError && currentMonthTargets && currentMonthTargets.length > 0) {
        totalMcvPlanned = currentMonthTargets.reduce((sum, targetRecord) => {
          const targetValue = parseFloat(targetRecord.target?.toString() || "0") || 0;
          return sum + targetValue;
        }, 0);
        console.log(`MCV Planned for ${currentMonth}/${currentYear} (${filterFinancialYear}):`, totalMcvPlanned, "from", currentMonthTargets.length, "target(s)");
        console.log(`[DEBUG] Target details:`, currentMonthTargets.map(t => ({
          target: t.target,
          financial_year: t.financial_year,
          target_type: t.target_type
        })));
      } else {
        console.log(`No targets found for month=${currentMonth}, year=${currentYear}, financial_year=${financialYearString || 'NONE SELECTED'}, statusFilter=${filterUpsellStatus}`);
        totalMcvPlanned = 0;
      }

      // Fetch all mandates with monthly_data to calculate FFM Achieved for current month within selected FY
      // Apply status filter based on filterUpsellStatus
      let mandatesQuery = supabase
        .from("mandates")
        .select("monthly_data, type");
      mandatesQuery = applyStatusFilter(mandatesQuery, filterUpsellStatus);
      mandatesQuery = applyKamFilter(mandatesQuery, filterKam);
      const { data: allMandatesForMcv, error: mcvError } = await mandatesQuery;

      if (filterUpsellStatus === "All Cross Sell") {
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
                    
                    // Only include if within selected FY date range and current month
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end && monthYear === currentMonthYear) {
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
                    
                    // Only include if within selected FY date range and current month
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end && monthYear === currentMonthYear) {
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
                    
                    // Only include if within selected FY date range and current month
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end && monthYear === currentMonthYear) {
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
                    
                    // Only include if within selected FY date range and current month
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end && monthYear === currentMonthYear) {
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
                if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                  // Check if this month falls within the selected financial year
                  const [yearStr, monthStr] = monthYear.split('-');
                  const year = parseInt(yearStr);
                  const month = parseInt(monthStr);
                  const monthDate = new Date(year, month - 1, 1);
                  
                  // Only include if within selected FY date range and current month
                  if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end && monthYear === currentMonthYear) {
                    const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                    totalFfmAchieved += achievedMcv;
                  }
                }
              });
            }
          });
        }
      }

      // Calculate FFM Achieved percentage: (FFM Achieved / MCV Planned) * 100
      const ffmPercentage = totalMcvPlanned > 0 
        ? (totalFfmAchieved / totalMcvPlanned) * 100 
        : 0;

      // Calculate MCV This Quarter (sum of achieved MCV for current quarter)
      // Financial year quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
      // Reuse currentMonth and currentYear already declared above
      let quarterMonths: number[] = [];
      let quarterYear: number; // The calendar year that contains the quarter months
      
      if (currentMonth >= 4 && currentMonth <= 6) {
        // Q1: April, May, June - months are in current year
        quarterMonths = [4, 5, 6];
        quarterYear = currentYear;
      } else if (currentMonth >= 7 && currentMonth <= 9) {
        // Q2: July, August, September - months are in current year
        quarterMonths = [7, 8, 9];
        quarterYear = currentYear;
      } else if (currentMonth >= 10 && currentMonth <= 12) {
        // Q3: October, November, December - months are in current year
        quarterMonths = [10, 11, 12];
        quarterYear = currentYear;
      } else {
        // Q4: January, February, March - months are in current year
        quarterMonths = [1, 2, 3];
        quarterYear = currentYear;
      }

      let totalMcvThisQuarter = 0;

      // Calculate sum of achieved MCV for current quarter months
      if (filterUpsellStatus === "All Cross Sell") {
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
                    if (quarterMonths.includes(monthNum) && yearNum === quarterYear && 
                        monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
                    if (quarterMonths.includes(monthNum) && yearNum === quarterYear && 
                        monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
                    if (quarterMonths.includes(monthNum) && yearNum === quarterYear && 
                        monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
                    if (quarterMonths.includes(monthNum) && yearNum === quarterYear && 
                        monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
                      totalMcvThisQuarter += achievedMcv;
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
                if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                  const [year, month] = monthYear.split('-');
                  const yearNum = parseInt(year);
                  const monthNum = parseInt(month);
                  const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                  
                  // Check if this month belongs to the current quarter and selected FY
                  const monthDate = new Date(yearNum, monthNum - 1, 1);
                  if (quarterMonths.includes(monthNum) && yearNum === quarterYear && 
                      monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
                    totalMcvThisQuarter += achievedMcv;
                  }
                }
              });
            }
          });
        }
      }

      setMcvPlanned(totalMcvPlanned);
      setFfmAchieved(totalFfmAchieved);
      setFfmAchievedFyPercentage(ffmPercentage);
      setMcvThisQuarter(totalMcvThisQuarter);

      // Calculate Target MCV Next Quarter
      // Determine next quarter months
      let nextQuarterMonths: number[] = [];
      let nextQuarterYear: number;
      
      if (currentMonth >= 4 && currentMonth <= 6) {
        // Current is Q1, next is Q2: July, August, September
        nextQuarterMonths = [7, 8, 9];
        nextQuarterYear = currentYear;
      } else if (currentMonth >= 7 && currentMonth <= 9) {
        // Current is Q2, next is Q3: October, November, December
        nextQuarterMonths = [10, 11, 12];
        nextQuarterYear = currentYear;
      } else if (currentMonth >= 10 && currentMonth <= 12) {
        // Current is Q3, next is Q4: January, February, March (next year)
        nextQuarterMonths = [1, 2, 3];
        nextQuarterYear = currentYear + 1;
      } else {
        // Current is Q4, next is Q1: April, May, June (same year)
        nextQuarterMonths = [4, 5, 6];
        nextQuarterYear = currentYear;
      }

      // Fetch targets for next quarter months within selected FY
      let nextQuarterQuery = supabase
        .from("monthly_targets")
        .select("target, kam_id, mandate_id, mandates(kam_id)")
        .in("month", nextQuarterMonths)
        .eq("year", nextQuarterYear);
      
      // Filter by financial_year if available
      if (financialYearString) {
        nextQuarterQuery = nextQuarterQuery.eq("financial_year", financialYearString);
      }
      
      // Apply target type filter based on status filter
      nextQuarterQuery = applyTargetTypeFilter(nextQuarterQuery, filterUpsellStatus);
      
      const { data: allNextQuarterTargets, error: nextQuarterTargetsError } = await nextQuarterQuery;

      // Apply KAM filter client-side to handle both direct kam_id and via mandate
      let nextQuarterTargets = allNextQuarterTargets;
      if (filterKam && filterKam !== "" && allNextQuarterTargets) {
        nextQuarterTargets = allNextQuarterTargets.filter((target: any) => {
          // For new_cross_sell targets: check monthly_targets.kam_id directly
          if (target.kam_id === filterKam) {
            return true;
          }
          // For existing targets: check mandate's kam_id
          // Handle both single object and array (though it should be single)
          const mandate = Array.isArray(target.mandates) ? target.mandates[0] : target.mandates;
          if (target.mandate_id && mandate && mandate.kam_id === filterKam) {
            return true;
          }
          return false;
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
      
      if (filterUpsellStatus === "All Cross Sell") {
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
                    
                    // Only include if within selected FY date range
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
                    
                    // Only include if within selected FY date range
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
                    
                    // Only include if within selected FY date range
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
                      totalAnnualAchieved += achievedMcv;
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
                if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                  const [year, month] = monthYear.split('-');
                  const yearNum = parseInt(year);
                  const monthNum = parseInt(month);
                  const monthDate = new Date(yearNum, monthNum - 1, 1);
                  const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                  
                  // Only include if within selected FY date range
                  if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
                    totalAnnualAchieved += achievedMcv;
                  }
                }
              });
            }
          });
        }
      }
      
      // Calculate Annual Target: Sum of targets for all months in selected FY from monthly_targets table
      // Get all months in the FY: April to December of start year, and January to March of end year
      const fyMonths = [
        { month: 4, year: fyStartYear },
        { month: 5, year: fyStartYear },
        { month: 6, year: fyStartYear },
        { month: 7, year: fyStartYear },
        { month: 8, year: fyStartYear },
        { month: 9, year: fyStartYear },
        { month: 10, year: fyStartYear },
        { month: 11, year: fyStartYear },
        { month: 12, year: fyStartYear },
        { month: 1, year: fyEndYear },
        { month: 2, year: fyEndYear },
        { month: 3, year: fyEndYear },
      ];
      
      // Fetch targets for all FY months
      const fyMonthNumbers = fyMonths.map(m => m.month);
      const fyYears = [fyStartYear, fyEndYear];
      
      let fyTargetsQuery = supabase
        .from("monthly_targets")
        .select("target, month, year, kam_id, mandate_id, mandates(kam_id)")
        .in("month", fyMonthNumbers)
        .in("year", fyYears);
      
      // Filter by financial_year if available
      if (financialYearString) {
        fyTargetsQuery = fyTargetsQuery.eq("financial_year", financialYearString);
      }
      
      // Apply target type filter based on status filter
      fyTargetsQuery = applyTargetTypeFilter(fyTargetsQuery, filterUpsellStatus);
      
      const { data: allFyTargets, error: fyTargetsError } = await fyTargetsQuery;
      
      // Apply KAM filter client-side to handle both direct kam_id and via mandate
      let fyTargets = allFyTargets;
      if (filterKam && filterKam !== "" && allFyTargets) {
        fyTargets = allFyTargets.filter((target: any) => {
          // For new_cross_sell targets: check monthly_targets.kam_id directly
          if (target.kam_id === filterKam) {
            return true;
          }
          // For existing targets: check mandate's kam_id
          // Handle both single object and array (though it should be single)
          const mandate = Array.isArray(target.mandates) ? target.mandates[0] : target.mandates;
          if (target.mandate_id && mandate && mandate.kam_id === filterKam) {
            return true;
          }
          return false;
        });
      }
      
      let totalAnnualTarget = 0;
      if (!fyTargetsError && fyTargets) {
        // Filter to only include targets that match the FY months exactly
        fyTargets.forEach((target: any) => {
          const matchesFyMonth = fyMonths.some(
            (fyMonth) => fyMonth.month === target.month && fyMonth.year === target.year
          );
          if (matchesFyMonth) {
            totalAnnualTarget += parseFloat(target.target?.toString() || "0") || 0;
          }
        });
      }
      
      setAnnualAchieved(totalAnnualAchieved);
      setAnnualTarget(totalAnnualTarget);

      // Calculate Current Quarter Target
      // Reuse currentMonth and currentYear from the mcvThisQuarter calculation above
      // Financial year quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
      // Note: currentMonth and currentYear are already declared above
      let quarterMonthsForTarget: number[] = [];
      let quarterYearForTarget: number;
      
      if (currentMonth >= 4 && currentMonth <= 6) {
        quarterMonthsForTarget = [4, 5, 6];
        quarterYearForTarget = currentYear;
      } else if (currentMonth >= 7 && currentMonth <= 9) {
        quarterMonthsForTarget = [7, 8, 9];
        quarterYearForTarget = currentYear;
      } else if (currentMonth >= 10 && currentMonth <= 12) {
        quarterMonthsForTarget = [10, 11, 12];
        quarterYearForTarget = currentYear;
      } else {
        quarterMonthsForTarget = [1, 2, 3];
        quarterYearForTarget = currentYear;
      }

      // Calculate Quarter Target: Sum of targets for current quarter months from monthly_targets table within selected FY
      let quarterTargetsQuery = supabase
        .from("monthly_targets")
        .select("target, kam_id, mandate_id, mandates(kam_id)")
        .in("month", quarterMonthsForTarget)
        .eq("year", quarterYearForTarget);
      
      // Filter by financial_year if available
      if (financialYearString) {
        quarterTargetsQuery = quarterTargetsQuery.eq("financial_year", financialYearString);
      }
      
      // Apply target type filter based on status filter
      quarterTargetsQuery = applyTargetTypeFilter(quarterTargetsQuery, filterUpsellStatus);
      
      const { data: allQuarterTargets, error: quarterTargetsError } = await quarterTargetsQuery;

      // Apply KAM filter client-side to handle both direct kam_id and via mandate
      let quarterTargets = allQuarterTargets;
      if (filterKam && filterKam !== "" && allQuarterTargets) {
        quarterTargets = allQuarterTargets.filter((target: any) => {
          // For new_cross_sell targets: check monthly_targets.kam_id directly
          if (target.kam_id === filterKam) {
            return true;
          }
          // For existing targets: check mandate's kam_id
          // Handle both single object and array (though it should be single)
          const mandate = Array.isArray(target.mandates) ? target.mandates[0] : target.mandates;
          if (target.mandate_id && mandate && mandate.kam_id === filterKam) {
            return true;
          }
          return false;
        });
      }

      let totalQuarterTarget = 0;
      if (!quarterTargetsError && quarterTargets) {
        totalQuarterTarget = quarterTargets.reduce((sum, target) => {
          return sum + (parseFloat(target.target?.toString() || "0") || 0);
        }, 0);
      }

      // Reuse mcvThisQuarter for quarterAchieved since they're the same calculation
      setQuarterAchieved(totalMcvThisQuarter);
      setQuarterTarget(totalQuarterTarget);

      // Calculate Current Month Achieved and Target
      // Note: currentMonthYear is already declared above (line 705)
      
      // Calculate Current Month Achieved: Sum of achieved MCV for current month from all mandates
      let totalCurrentMonthAchieved = 0;
      
      if (filterUpsellStatus === "All Cross Sell") {
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
                      
                      // Only include if within selected FY date range
                      if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
                      
                      // Only include if within selected FY date range
                      if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
        // For other statuses, use mandates
        if (!mcvError && allMandatesForMcv) {
          allMandatesForMcv.forEach((mandate: any) => {
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
                    
                    // Only include if within selected FY date range
                    if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
                      const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                      totalCurrentMonthAchieved += achievedMcv;
                    }
                  }
                }
              });
            }
          });
        }
      }
      
      // Calculate Current Month Target: Get target for current month from monthly_targets table within selected FY
      // Sum all targets for the current month (there may be multiple targets with different types)
      let currentMonthTargetQuery = supabase
        .from("monthly_targets")
        .select("target, kam_id, mandate_id, mandates(kam_id)")
        .eq("month", currentMonth)
        .eq("year", currentYear);
      
      // Filter by financial_year if available
      if (financialYearString) {
        currentMonthTargetQuery = currentMonthTargetQuery.eq("financial_year", financialYearString);
      }
      
      // Apply target type filter based on status filter
      currentMonthTargetQuery = applyTargetTypeFilter(currentMonthTargetQuery, filterUpsellStatus);
      
      const { data: allCurrentMonthTargetsData, error: currentMonthTargetError } = await currentMonthTargetQuery;

      // Apply KAM filter client-side to handle both direct kam_id and via mandate
      let currentMonthTargetsData = allCurrentMonthTargetsData;
      if (filterKam && filterKam !== "" && allCurrentMonthTargetsData) {
        currentMonthTargetsData = allCurrentMonthTargetsData.filter((target: any) => {
          // For new_cross_sell targets: check monthly_targets.kam_id directly
          if (target.kam_id === filterKam) {
            return true;
          }
          // For existing targets: check mandate's kam_id
          // Handle both single object and array (though it should be single)
          const mandate = Array.isArray(target.mandates) ? target.mandates[0] : target.mandates;
          if (target.mandate_id && mandate && mandate.kam_id === filterKam) {
            return true;
          }
          return false;
        });
      }

      let totalCurrentMonthTarget = 0;
      if (!currentMonthTargetError && currentMonthTargetsData && currentMonthTargetsData.length > 0) {
        totalCurrentMonthTarget = currentMonthTargetsData.reduce((sum, targetRecord) => {
          const targetValue = parseFloat(targetRecord.target?.toString() || "0") || 0;
          return sum + targetValue;
        }, 0);
      }

      setCurrentMonthAchieved(totalCurrentMonthAchieved);
      setCurrentMonthTarget(totalCurrentMonthTarget);

      // Fetch Dropped Sales and Reasons data
      const { data: droppedDeals, error: droppedDealsError } = await supabase
        .from("pipeline_deals")
        .select("dropped_reason")
        .eq("status", "Dropped")
        .not("dropped_reason", "is", null);

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
      // Generate month columns from April to March of the selected financial year
      // Show ALL months in the selected FY, including future months (to allow viewing historical data)
      const fyStartMonth = 4; // April
      const fyEndMonth = 3; // March
      
      const monthColumns: Array<{ month: number; year: number; key: string; label: string }> = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // April to December of FY start year
      for (let month = fyStartMonth; month <= 12; month++) {
        monthColumns.push({
          month,
          year: fyStartYear,
          key: `${fyStartYear}-${String(month).padStart(2, '0')}`,
          label: `${monthNames[month - 1]} ${fyStartYear}`,
        });
      }
      
      // January to March of FY end year
      for (let month = 1; month <= fyEndMonth; month++) {
        monthColumns.push({
          month,
          year: fyEndYear,
          key: `${fyEndYear}-${String(month).padStart(2, '0')}`,
          label: `${monthNames[month - 1]} ${fyEndYear}`,
        });
      }

      // Fetch all accounts (we need all accounts that have mandates to determine MCV Tier)
      const { data: accountsData, error: accountsTierError } = await supabase
        .from("accounts")
        .select("id, company_size_tier");

      // Fetch mandates with account_id and monthly_data
      // Apply status filter to only consider mandates with the selected status
      let mandatesTierQuery = supabase
        .from("mandates")
        .select("id, account_id, monthly_data, type");
      mandatesTierQuery = applyStatusFilter(mandatesTierQuery, filterUpsellStatus);
      mandatesTierQuery = applyKamFilter(mandatesTierQuery, filterKam);
      const { data: mandatesTierData, error: mandatesTierError } = await mandatesTierQuery;

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
                
                // Only include if within selected FY date range
                if (monthDate >= fyDateRange.start && monthDate <= fyDateRange.end) {
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
              const isInFYRange = monthDate >= fyDateRange.start && monthDate <= fyDateRange.end;
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

      // Fetch all targets for accounts in the selected FY
      // For existing targets, we need mandate_id to get account_id
      let tierTargetsQuery = supabase
        .from("monthly_targets")
        .select("account_id, mandate_id, month, year, target")
        .eq("target_type", "existing");

      if (tierFinancialYearString) {
        tierTargetsQuery = tierTargetsQuery.eq("financial_year", tierFinancialYearString);
      }

      const { data: tierTargetsData, error: tierTargetsError } = await tierTargetsQuery;

      // Create a map of mandate_id to account_id from mandates data
      const mandateToAccountMap: Record<string, string> = {};
      if (!mandatesTierError && mandatesTierData) {
        mandatesTierData.forEach((mandate: any) => {
          if (mandate.account_id && mandate.id) {
            mandateToAccountMap[mandate.id] = mandate.account_id;
          }
        });
      }

      // Initialize target data structure by tier
      const tierTargetData: Record<string, Record<string, number>> = {
        "MCV Tier_Tier 1": {},
        "MCV Tier_Tier 2": {},
      };

      // Initialize all months with 0 for targets
      monthColumns.forEach((col) => {
        Object.keys(tierTargetData).forEach((key) => {
          tierTargetData[key][col.key] = 0;
        });
      });

      // Map targets to tiers based on account_id
      // Sum all targets for accounts in each tier, month-wise
      if (!tierTargetsError && tierTargetsData) {
        tierTargetsData.forEach((target: any) => {
          // For existing targets, account_id might be null, so get it from mandate_id
          let accountId = target.account_id;
          if (!accountId && target.mandate_id) {
            accountId = mandateToAccountMap[target.mandate_id];
          }
          
          if (!accountId) return;

          const accountTiers = accountTierMap[accountId];
          // Only include targets for accounts that have an MCV Tier assigned
          if (!accountTiers || !accountTiers.mcvTier) return;

          const monthYear = `${target.year}-${String(target.month).padStart(2, '0')}`;
          
          // Check if this month is in our month columns
          if (monthColumns.some((col) => col.key === monthYear)) {
            const tierKey = `MCV Tier_${accountTiers.mcvTier}`;
            if (tierTargetData[tierKey]) {
              // Sum targets for all accounts in this tier for this month
              tierTargetData[tierKey][monthYear] = (tierTargetData[tierKey][monthYear] || 0) + parseFloat(target.target?.toString() || "0");
            }
          }
        });
      }

      // Calculate cumulative values for Actual (achieved MCV)
      const tierActualData: Record<string, Record<string, number>> = {
        "MCV Tier_Tier 1": {},
        "MCV Tier_Tier 2": {},
      };

      // Get current date to determine which months are in the future
      // Reuse the 'currentYear' and 'currentMonth' variables already declared earlier in the function (around line 877-878)

      // Calculate cumulative values for each tier
      // Process months in order and accumulate
      // Only carry forward cumulative for past months. For current and future months without data, show 0
      monthColumns.forEach((col, index) => {
        Object.keys(tierDataMap).forEach((tierKey) => {
          // Get current month's value
          const currentMonthValue = monthlyTierData[tierKey][col.key] || 0;
          
          // Check if this month is in the past (already completed)
          const isPastMonth = col.year < currentYear || 
            (col.year === currentYear && col.month < currentMonth);
          
          // Check if this month is the current month
          const isCurrentMonth = col.year === currentYear && col.month === currentMonth;
          
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

      // Convert to array format for display - 4 rows per tier
      const formattedTierData: Array<{
        category: string;
        tier: string;
        rowType: string;
        [key: string]: string | number;
      }> = [];

      // For each tier, create 4 rows
      ["Tier 1", "Tier 2"].forEach((tier) => {
        const tierKey = `MCV Tier_${tier}`;
        
        // Row 1: Target (only this row shows category and tier)
        formattedTierData.push({
          category: "MCV Tier",
          tier: tier,
          rowType: "Target",
          ...monthColumns.reduce((acc, col) => {
            const value = tierCumulativeTargetData[tierKey][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        });

        // Row 2: Actual (empty category and tier)
        formattedTierData.push({
          category: "",
          tier: "",
          rowType: "Actual",
          ...monthColumns.reduce((acc, col) => {
            const value = tierActualData[tierKey][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        });

        // Row 3: Achievement (Percentage) (empty category and tier)
        formattedTierData.push({
          category: "",
          tier: "",
          rowType: "Achievement",
          ...monthColumns.reduce((acc, col) => {
            const target = tierCumulativeTargetData[tierKey][col.key] || 0;
            const actual = tierActualData[tierKey][col.key] || 0;
            const percentage = target > 0 ? (actual / target) * 100 : 0;
            acc[col.key] = `${percentage.toFixed(1)}%`;
            return acc;
          }, {} as Record<string, string>),
        });

        // Row 4: Balance (Target - Actual) (empty category and tier)
        // Store raw numeric value for Balance row to enable color coding
        formattedTierData.push({
          category: "",
          tier: "",
          rowType: "Balance",
          ...monthColumns.reduce((acc, col) => {
            const target = tierCumulativeTargetData[tierKey][col.key] || 0;
            const actual = tierActualData[tierKey][col.key] || 0;
            const balance = target - actual;
            // Store raw numeric value (will be formatted with colors in display)
            acc[col.key] = balance;
            return acc;
          }, {} as Record<string, number | string>),
        });
      });

      setMcvTierData(formattedTierData);
      setTierMonthColumns(monthColumns);

      setTotalMandates(totalCount || 0);
      setMandatesThisMonth(monthCount || 0);
      setTotalAccounts(accountsCount || 0);
      setAvgAwignShare(average);
      setOverlapFactor(overlap);
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

  return (
    <div className="space-y-6 p-6">
      {/* Main Dashboard Section */}
      <Card className="bg-blue-100/60">
        <CardContent className="p-6 space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        {/* Guide Button */}
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => setGuideDialogOpen(true)}
        >
          <BookOpen className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-4">
        {/* Financial Year Filter */}
        <Select value={filterFinancialYear} onValueChange={setFilterFinancialYear}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Financial Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FY24">FY24</SelectItem>
            <SelectItem value="FY25">FY25</SelectItem>
            <SelectItem value="FY26">FY26</SelectItem>
            <SelectItem value="FY27">FY27</SelectItem>
            <SelectItem value="FY28">FY28</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={filterUpsellStatus} onValueChange={(value) => setFilterUpsellStatus(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Existing">Existing</SelectItem>
            <SelectItem value="All Cross Sell">All Cross Sell</SelectItem>
            <SelectItem value="All Cross Sell + Existing">All Cross Sell + Existing</SelectItem>
            <SelectItem value="New Acquisitions">New Acquisitions</SelectItem>
          </SelectContent>
        </Select>

        {/* KAM Filter with Search */}
        <Select value={filterKam || "all"} onValueChange={(value) => setFilterKam(value === "all" ? "" : value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All KAMs" />
          </SelectTrigger>
          <SelectContent>
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
            <SelectItem value="all">All KAMs</SelectItem>
            {kams
              .filter((kam) => kam.full_name?.toLowerCase().includes(kamSearch.toLowerCase()))
              .map((kam) => (
                <SelectItem key={kam.id} value={kam.id}>
                  {kam.full_name}
                </SelectItem>
              ))}
            {kams.filter((kam) => kam.full_name?.toLowerCase().includes(kamSearch.toLowerCase())).length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No KAMs found
              </div>
            )}
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* Key Metrics Cards - 8 cards in 2 rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Mandates */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-base font-bold mb-2">Total Mandates</p>
                <div className="text-3xl font-bold">{totalMandates.toLocaleString("en-IN")}</div>
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
                <div className="text-3xl font-bold">{totalAccounts.toLocaleString("en-IN")}</div>
                <p className="text-xs text-muted-foreground mt-2">Unique accounts from mandates</p>
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
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
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
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth() + 1;
                    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
                    const fyEndYear = (fyStartYear + 1).toString().slice(-2);
                    const fyString = `FY${fyEndYear}`;
                    return `${fyString} (${ffmAchievedFyPercentage.toFixed(1)}% of Target MCV)`;
                  })()}
                </p>
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
                  {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth() + 1;
                    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
                    const fyEndYear = (fyStartYear + 1).toString().slice(-2);
                    const fyString = `FY${fyEndYear}`;
                    
                    // Determine quarter months
                    let quarterMonths: number[] = [];
                    if (currentMonth >= 4 && currentMonth <= 6) {
                      quarterMonths = [4, 5, 6];
                    } else if (currentMonth >= 7 && currentMonth <= 9) {
                      quarterMonths = [7, 8, 9];
                    } else if (currentMonth >= 10 && currentMonth <= 12) {
                      quarterMonths = [10, 11, 12];
                    } else {
                      quarterMonths = [1, 2, 3];
                    }
                    
                    // Format month names (abbreviated)
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const quarterMonthNames = quarterMonths.map(m => monthNames[m - 1]).join(', ');
                    
                    return `${fyString} (${fyStartYear}-${fyStartYear + 1}) - ${quarterMonthNames}`;
                  })()}
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
                  {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth() + 1;
                    
                    // Determine next quarter months and year
                    let nextQuarterMonths: number[] = [];
                    let nextQuarterYear: number;
                    
                    if (currentMonth >= 4 && currentMonth <= 6) {
                      nextQuarterMonths = [7, 8, 9];
                      nextQuarterYear = currentYear;
                    } else if (currentMonth >= 7 && currentMonth <= 9) {
                      nextQuarterMonths = [10, 11, 12];
                      nextQuarterYear = currentYear;
                    } else if (currentMonth >= 10 && currentMonth <= 12) {
                      nextQuarterMonths = [1, 2, 3];
                      nextQuarterYear = currentYear + 1;
                    } else {
                      nextQuarterMonths = [4, 5, 6];
                      nextQuarterYear = currentYear;
                    }
                    
                    // Format month names (abbreviated)
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const quarterMonthNames = nextQuarterMonths.map(m => monthNames[m - 1]).join(', ');
                    
                    return `${quarterMonthNames} ${nextQuarterYear}`;
                  })()}
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
                  {totalMandates} mandates / {totalAccounts} accounts
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
              {`${filterFinancialYear} Actual vs Target (Annual)`}
            </CardTitle>
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
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} hide />
                    <Tooltip 
                      formatter={(value: any, name: string, props: any) => {
                        // Show original values instead of base/overlay
                        if (name === 'Target' || name === 'Achieved') {
                          const payload = props.payload;
                          if (name === 'Target') {
                            return [formatTooltipValue(payload.target || 0), 'Target'];
                          } else if (name === 'Achieved') {
                            return [formatTooltipValue(payload.achieved || 0), 'Achieved'];
                          }
                        }
                        return [formatTooltipValue(typeof value === 'number' ? value : parseFloat(value) || 0), name];
                      }}
                      labelFormatter={() => ''}
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
              {`${filterFinancialYear} Actual vs Target (${getCurrentFinancialYearQuarter()})`}
            </CardTitle>
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
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} hide />
                    <Tooltip 
                      formatter={(value: any, name: string, props: any) => {
                        // Show original values instead of base/overlay
                        if (name === 'Target' || name === 'Achieved') {
                          const payload = props.payload;
                          if (name === 'Target') {
                            return [formatTooltipValue(payload.target || 0), 'Target'];
                          } else if (name === 'Achieved') {
                            return [formatTooltipValue(payload.achieved || 0), 'Achieved'];
                          }
                        }
                        return [formatTooltipValue(typeof value === 'number' ? value : parseFloat(value) || 0), name];
                      }}
                      labelFormatter={() => ''}
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
              {(() => {
                const now = new Date();
                const monthName = now.toLocaleString('default', { month: 'long' });
                return `${filterFinancialYear} Actual vs Target (${monthName})`;
              })()}
            </CardTitle>
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
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} hide />
                    <Tooltip 
                      formatter={(value: any, name: string, props: any) => {
                        // Show original values instead of base/overlay
                        if (name === 'Target' || name === 'Achieved') {
                          const payload = props.payload;
                          if (name === 'Target') {
                            return [formatTooltipValue(payload.target || 0), 'Target'];
                          } else if (name === 'Achieved') {
                            return [formatTooltipValue(payload.achieved || 0), 'Achieved'];
                          }
                        }
                        return [formatTooltipValue(typeof value === 'number' ? value : parseFloat(value) || 0), name];
                      }}
                      labelFormatter={() => ''}
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

      {/* LoB Sales Performance Comparison and Annual Sales Target - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LoB Existing Sales Performance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>LoB Existing Sales Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lobSalesPerformance.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={lobSalesPerformance.map((item) => {
                  // Use achieved MPV only
                  return {
                    ...item,
                    achievedMpv: ensureMinimumBarLengthForBoth(item.achievedMpv, item.achievedMpv),
                  };
                })}
                margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                barCategoryGap="20%"
                barGap={0}
              >
                <XAxis 
                  dataKey="lob" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis hide />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    const formattedValue = value >= 10000000
                      ? `₹${(value / 10000000).toFixed(2)}Cr`
                      : value >= 100000
                      ? `₹${(value / 100000).toFixed(1)}L`
                      : `₹${value.toLocaleString("en-IN")}`;
                    return formattedValue;
                  }}
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                          {payload.map((entry: any, index: number) => {
                            // Only show achieved values
                            if (entry.name === "Achieved") {
                              return (
                                <p key={index} style={{ color: "#4169E1" }}>
                                  {entry.name}: {entry.value >= 10000000
                                    ? `₹${(entry.value / 10000000).toFixed(2)}Cr`
                                    : entry.value >= 100000
                                    ? `₹${(entry.value / 100000).toFixed(1)}L`
                                    : `₹${entry.value.toLocaleString("en-IN")}`}
                                </p>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={false}
                />
                <Legend align="right" verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                {/* Achieved bar (blue) */}
                <Bar 
                  dataKey="achievedMpv" 
                  fill="#4169E1" 
                  name="Achieved" 
                  barSize={30}
                  radius={[4, 4, 0, 0]}
                  activeBar={false}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
        </Card>

        {/* Annual Sales Target - Individual */}
        <Card>
        <CardHeader>
          <CardTitle>{filterFinancialYear} Annual Sales Target - Individual</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Compare target vs achieved sales for individual staff members.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : kamSalesPerformance.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
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
                margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                barCategoryGap="20%"
                barGap={0}
              >
                <XAxis 
                  dataKey="kamName" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis hide />
                <Tooltip 
                  formatter={(value: any, name: string, props: any) => {
                    const payload = props.payload;
                    // Convert Base/Overlay to Target/Achieved based on the data
                    let displayName = name;
                    let originalValue = 0;
                    
                    if (name === 'Base' || name === 'Overlay') {
                      // Determine which field this represents based on the data
                      const isAchievedGreater = payload.achievedMpv > payload.targetMpv;
                      if (name === 'Base') {
                        displayName = isAchievedGreater ? 'Target' : 'Achieved';
                        originalValue = isAchievedGreater ? payload.targetMpv : payload.achievedMpv;
                      } else { // Overlay
                        displayName = isAchievedGreater ? 'Achieved' : 'Target';
                        originalValue = isAchievedGreater ? payload.achievedMpv : payload.targetMpv;
                      }
                    } else if (name === 'Target' || name === 'Achieved') {
                      originalValue = name === 'Target' ? payload.targetMpv : payload.achievedMpv;
                    } else {
                      // Fallback
                      originalValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                    }
                    
                    // Format the value
                    if (originalValue >= 10000000) {
                      return [`₹${(originalValue / 10000000).toFixed(2)}Cr`, displayName];
                    } else if (originalValue >= 100000) {
                      return [`₹${(originalValue / 100000).toFixed(1)}L`, displayName];
                    } else {
                      return [`₹${originalValue.toLocaleString("en-IN")}`, displayName];
                    }
                  }}
                  cursor={false}
                />
                <Legend 
                  align="right" 
                  verticalAlign="top" 
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', backgroundColor: '#4169E1', borderRadius: '2px' }}></div>
                          <span style={{ fontSize: '11px' }}>Achieved</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', backgroundColor: '#E0E0E0', borderRadius: '2px' }}></div>
                          <span style={{ fontSize: '11px' }}>Target</span>
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
                  barSize={30}
                  radius={[4, 4, 0, 0]}
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
                  barSize={30}
                  radius={[4, 4, 0, 0]}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Type</TableHead>
                  {tierMonthColumns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  if (mcvTierData.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={tierMonthColumns.length + 3} className="text-center text-muted-foreground py-8">
                          No data available
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return mcvTierData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.tier}</TableCell>
                      <TableCell>{row.rowType}</TableCell>
                      {tierMonthColumns.map((col) => {
                        const cellValue = row[col.key];
                        
                        // Special handling for Balance row: color code based on sign
                        if (row.rowType === "Balance") {
                          const balanceValue = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue?.toString() || "0") || 0;
                          const isNegative = balanceValue < 0;
                          const isPositive = balanceValue > 0;
                          const displayValue = Math.abs(balanceValue);
                          const formattedValue = formatCurrency(displayValue);
                          
                          // Apply color: green for negative (surplus), red for positive (deficit), default for zero
                          const colorClass = isNegative 
                            ? "text-green-600 font-medium" 
                            : isPositive 
                            ? "text-red-600 font-medium" 
                            : "";
                          
                          return (
                            <TableCell 
                              key={col.key}
                              className={colorClass}
                            >
                              {formattedValue}
                            </TableCell>
                          );
                        }
                        
                        // Default display for other rows
                        return (
                          <TableCell key={col.key}>
                            {cellValue || (row.rowType === "Achievement" ? "0.0%" : "₹0")}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
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
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{row.revenue}</TableCell>
                      <TableCell>{row.accounts}</TableCell>
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
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{row.revenue}</TableCell>
                      <TableCell>{row.accounts}</TableCell>
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
                  const getDiffColor = (diff: string) => {
                    const numValue = parseInt(diff);
                    if (numValue > 0) return "text-green-600 font-semibold";
                    if (numValue < 0) return "text-red-600 font-semibold";
                    return "text-yellow-600 font-semibold";
                  };

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.group}</TableCell>
                      <TableCell>{row.prevCount}</TableCell>
                      <TableCell>{row.currCount}</TableCell>
                      <TableCell className={`${getDiffColor(row.countDiff)} border-r`}>{row.countDiff}</TableCell>
                      <TableCell>{row.prevRev}</TableCell>
                      <TableCell>{row.currRev}</TableCell>
                      <TableCell className={`${getDiffColor(row.revDiff)} border-r`}>{row.revDiff}</TableCell>
                      <TableCell>{row.prevAcc}</TableCell>
                      <TableCell>{row.currAcc}</TableCell>
                      <TableCell className={getDiffColor(row.accDiff)}>{row.accDiff}</TableCell>
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
