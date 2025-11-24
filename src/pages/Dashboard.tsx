import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
  const [conversionTableData, setConversionTableData] = useState<Array<{
    status: string;
    records: number;
    cvr: string;
    remaining: number;
    dropped: number;
    maxRecords?: number;
  }>>([]);
  const [funnelCounts, setFunnelCounts] = useState<{
    tofu: number;
    bofu: number;
    closedWon: number;
    dropped: number;
  }>({ tofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
  const [funnelRevenue, setFunnelRevenue] = useState<{
    tofu: number;
    bofu: number;
    closedWon: number;
    dropped: number;
  }>({ tofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
  
  // Filter states
  const [filterFinancialYear, setFilterFinancialYear] = useState<string>("FY26");
  const [filterUpsellStatus, setFilterUpsellStatus] = useState<string>("all");
  const [filterKam, setFilterKam] = useState<string>("");
  const [kams, setKams] = useState<Array<{ id: string; full_name: string }>>([]);
  const [kamSearch, setKamSearch] = useState("");

  useEffect(() => {
    fetchDashboardData();
    fetchKams();
    fetchConversionTableData();
  }, []);

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

  const fetchConversionTableData = async () => {
    try {
      // Status order matching Pipeline.tsx
      const statusOrder = [
        "Listed",
        "Pre-Appointment Prep Done",
        "Discovery Meeting Done",
        "Requirement Gathering Done",
        "Solution Proposal Made",
        "SOW Handshake Done",
        "Final Proposal Done",
        "Commercial Agreed",
        "Closed Won",
        "Dropped",
      ];

      // Fetch all status history records to track all statuses each deal has been in
      const { data: allStatusHistory, error: historyError } = await (supabase
        .from("deal_status_history" as any)
        .select("deal_id, old_status, new_status") as any);

      if (historyError) throw historyError;

      // Fetch current deals to handle deals that might not have history yet (newly created with "Listed" status)
      const { data: currentDeals, error: dealsError } = await (supabase
        .from("pipeline_deals" as any)
        .select("id, status") as any);

      if (dealsError) throw dealsError;

      // Track unique deals per status using Sets
      // A deal is counted in a status if it appears in old_status or new_status in history
      const statusDealSets: Record<string, Set<string>> = {};
      
      // Initialize all statuses with empty Sets
      statusOrder.forEach((status) => {
        statusDealSets[status] = new Set<string>();
      });

      // Process all status history records
      if (allStatusHistory) {
        allStatusHistory.forEach((history: any) => {
          const dealId = history.deal_id;
          
          // Count deal in new_status (the status it moved to)
          if (history.new_status && statusDealSets.hasOwnProperty(history.new_status)) {
            statusDealSets[history.new_status].add(dealId);
          }
          
          // Count deal in old_status (the status it moved from)
          if (history.old_status && statusDealSets.hasOwnProperty(history.old_status)) {
            statusDealSets[history.old_status].add(dealId);
          }
        });
      }

      // Handle deals that are currently "Listed" but might not have history yet
      // (newly created deals start with "Listed" status)
      if (currentDeals) {
        currentDeals.forEach((deal: any) => {
          const status = deal.status;
          // If deal is "Listed" and not in the Set yet, add it
          // This handles newly created deals that haven't had their status changed yet
          if (status === "Listed" && statusDealSets["Listed"]) {
            statusDealSets["Listed"].add(deal.id);
          }
        });
      }

      // Convert Sets to counts
      const statusCounts: Record<string, number> = {};
      statusOrder.forEach((status) => {
        statusCounts[status] = statusDealSets[status]?.size || 0;
      });

      // Count deals that moved to Dropped from each status
      const droppedCounts: Record<string, number> = {};
      
      // Initialize all statuses (except Dropped) with 0
      statusOrder.filter((status) => status !== "Dropped").forEach((status) => {
        droppedCounts[status] = 0;
      });

      // Count how many deals went from each status to Dropped
      if (allStatusHistory) {
        allStatusHistory.forEach((history: any) => {
          if (history.new_status === "Dropped") {
            const oldStatus = history.old_status;
            // Only count if old_status is a valid status (not null and in our status list)
            if (oldStatus && droppedCounts.hasOwnProperty(oldStatus)) {
              droppedCounts[oldStatus] = (droppedCounts[oldStatus] || 0) + 1;
            }
          }
        });
      }

      // Count deals by their CURRENT status (for "Remaining" column)
      const currentStatusCounts: Record<string, number> = {};
      
      // Initialize all statuses with 0
      statusOrder.forEach((status) => {
        currentStatusCounts[status] = 0;
      });

      // Count deals per current status
      if (currentDeals) {
        currentDeals.forEach((deal: any) => {
          const status = deal.status;
          if (status && currentStatusCounts.hasOwnProperty(status)) {
            currentStatusCounts[status] = (currentStatusCounts[status] || 0) + 1;
          }
        });
      }

      // Calculate conversion table data - exclude Dropped from the table rows
      const statusOrderWithoutDropped = statusOrder.filter((status) => status !== "Dropped");
      
      const conversionData = statusOrderWithoutDropped.map((status, index) => {
        const count = statusCounts[status] || 0; // Cumulative count (from history)
        const remaining = currentStatusCounts[status] || 0; // Current status count
        const dropped = droppedCounts[status] || 0;
        
        // Calculate CVR: next status count / current status count
        let cvr = "-";
        if (index < statusOrderWithoutDropped.length - 1) {
          const nextStatus = statusOrderWithoutDropped[index + 1];
          const nextCount = statusCounts[nextStatus] || 0;
          
          if (count > 0) {
            const cvrValue = (nextCount / count) * 100;
            cvr = `${cvrValue.toFixed(1)}%`;
          } else if (nextCount > 0 && count === 0) {
            // If current status has 0 deals but next has deals, show as "N/A"
            cvr = "N/A";
          }
        }

        return {
          status: `${index}. ${status}`,
          records: count,
          cvr,
          remaining: remaining,
          dropped: dropped,
        };
      });

      // Find max records for progress bar calculation
      const maxRecords = Math.max(...conversionData.map((d) => d.records), 1);

      // Update conversion data with progress bar max
      const conversionDataWithMax = conversionData.map((d) => ({
        ...d,
        maxRecords,
      }));

      setConversionTableData(conversionDataWithMax);
    } catch (error) {
      console.error("Error fetching conversion table data:", error);
      setConversionTableData([]);
    }
  };

  const fetchKams = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .not("full_name", "is", null)
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Error fetching KAMs:", error);
        return;
      }

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
      
      // Get current month start and end dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Get previous month start and end dates
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      // Fetch total mandates count
      const { count: totalCount, error: totalError } = await supabase
        .from("mandates")
        .select("*", { count: "exact", head: true });

      if (totalError) throw totalError;

      // Fetch mandates created this month
      const { count: monthCount, error: monthError } = await supabase
        .from("mandates")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString());

      if (monthError) throw monthError;

      // Fetch total accounts count
      const { count: accountsCount, error: accountsError } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true });

      if (accountsError) throw accountsError;

      // Fetch mandates with awign_share_percent to calculate average
      const { data: mandatesData, error: mandatesDataError } = await supabase
        .from("mandates")
        .select("awign_share_percent")
        .not("awign_share_percent", "is", null);

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

      // Fetch mandates with retention_type = "B" for Group B upsell data
      const { data: groupBMandates, error: groupBError } = await supabase
        .from("mandates")
        .select("upsell_action_status, revenue_mcv, account_id")
        .eq("retention_type", "B")
        .not("upsell_action_status", "is", null);

      if (groupBError) throw groupBError;

      // Process Group B data
      const groupBData: Record<string, { count: number; revenue: number; accountIds: Set<string> }> = {};
      
      if (groupBMandates && groupBMandates.length > 0) {
        groupBMandates.forEach((mandate) => {
          const status = mandate.upsell_action_status || "Unknown";
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

      // Format Group B data for display
      const formattedGroupB = ["Not Started", "Ongoing", "Done"].map((status) => {
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

      // Fetch mandates with retention_type = "C" for Group C upsell data
      const { data: groupCMandates, error: groupCError } = await supabase
        .from("mandates")
        .select("upsell_action_status, revenue_mcv, account_id")
        .eq("retention_type", "C")
        .not("upsell_action_status", "is", null);

      if (groupCError) throw groupCError;

      // Process Group C data
      const groupCData: Record<string, { count: number; revenue: number; accountIds: Set<string> }> = {};
      
      if (groupCMandates && groupCMandates.length > 0) {
        groupCMandates.forEach((mandate) => {
          const status = mandate.upsell_action_status || "Unknown";
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

      // Format Group C data for display
      const formattedGroupC = ["Not Started", "Ongoing", "Done"].map((status) => {
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

      // Fetch all unique retention types for upsell performance
      const { data: allMandates, error: allMandatesError } = await supabase
        .from("mandates")
        .select("retention_type, revenue_mcv, account_id, created_at")
        .not("retention_type", "is", null);

      if (allMandatesError) throw allMandatesError;

      // Get unique retention types
      const retentionTypes = [...new Set((allMandates || []).map((m: any) => m.retention_type).filter(Boolean))].sort();

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
        // Previous month data (mandates created in previous month)
        const prevMonthMandates = (allMandates || []).filter((m: any) => {
          const createdDate = new Date(m.created_at);
          return m.retention_type === retentionType &&
                 createdDate >= prevMonthStart &&
                 createdDate <= prevMonthEnd;
        });

        // Current month data (mandates created in current month)
        const currMonthMandates = (allMandates || []).filter((m: any) => {
          const createdDate = new Date(m.created_at);
          return m.retention_type === retentionType &&
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

      const formattedPerformance = [
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

      // Fetch LoB Sales Performance data from mandates monthly records
      const { data: lobMandatesData, error: lobMandatesError } = await supabase
        .from("mandates")
        .select("lob, monthly_data");

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
              // Sum up all monthly records for this mandate
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                  const plannedMcv = parseFloat(monthRecord[0]?.toString() || "0") || 0;
                  const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                  
                  // Target MPV is sum of planned MCV
                  lobData[lob].targetMpv += plannedMcv;
                  
                  // Achieved MPV is sum of achieved MCV
                  lobData[lob].achievedMpv += achievedMcv;
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
      const { data: kamMandatesData, error: kamMandatesError } = await supabase
        .from("mandates")
        .select("kam_id, monthly_data");

      // Fetch all KAMs to get their names
      const { data: allKamsData, error: allKamsError } = await supabase
        .from("profiles")
        .select("id, full_name")
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
              // Sum up all monthly records for this mandate
              Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
                if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                  const plannedMcv = parseFloat(monthRecord[0]?.toString() || "0") || 0;
                  const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                  
                  // Target MPV is sum of planned MCV
                  kamData[kamId].targetMpv += plannedMcv;
                  
                  // Achieved MPV is sum of achieved MCV
                  kamData[kamId].achievedMpv += achievedMcv;
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

      // Calculate MCV Planned and FFM Achieved for current month
      const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let totalMcvPlanned = 0;
      let totalFfmAchieved = 0;

      // Fetch all mandates with monthly_data to calculate MCV Planned and FFM Achieved
      const { data: allMandatesForMcv, error: mcvError } = await supabase
        .from("mandates")
        .select("monthly_data");

      if (!mcvError && allMandatesForMcv) {
        allMandatesForMcv.forEach((mandate: any) => {
          const monthlyData = mandate.monthly_data;
          if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
            Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
              if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                const plannedMcv = parseFloat(monthRecord[0]?.toString() || "0") || 0;
                const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                
                // Sum for current month only
                if (monthYear === currentMonthYear) {
                  totalMcvPlanned += plannedMcv;
                  totalFfmAchieved += achievedMcv;
                }
              }
            });
          }
        });
      }

      // Calculate FFM Achieved percentage: (FFM Achieved / MCV Planned) * 100
      const ffmPercentage = totalMcvPlanned > 0 
        ? (totalFfmAchieved / totalMcvPlanned) * 100 
        : 0;

      // Calculate MCV This Quarter (sum of achieved MCV for current quarter)
      // Financial year quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();
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
                
                // Check if this month belongs to the current quarter
                if (quarterMonths.includes(monthNum) && yearNum === quarterYear) {
                  totalMcvThisQuarter += achievedMcv;
                }
              }
            });
          }
        });
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

      // Fetch targets for next quarter months
      const { data: nextQuarterTargets, error: targetsError } = await supabase
        .from("monthly_targets")
        .select("target")
        .in("month", nextQuarterMonths)
        .eq("year", nextQuarterYear);

      let totalTargetNextQuarter = 0;
      if (!targetsError && nextQuarterTargets) {
        totalTargetNextQuarter = nextQuarterTargets.reduce((sum, target) => {
          return sum + (parseFloat(target.target?.toString() || "0") || 0);
        }, 0);
      }

      setTargetMcvNextQuarter(totalTargetNextQuarter);

      // Calculate Annual Achieved and Target for current Financial Year
      // Financial year: April to March
      const fyStartMonth = 4; // April
      const currentMonthNum = now.getMonth() + 1; // 1-12
      const currentYearNum = now.getFullYear();
      
      // Determine financial year start year
      const fyStartYear = currentMonthNum >= 4 ? currentYearNum : currentYearNum - 1;
      const fyEndYear = fyStartYear + 1;
      
      // Calculate Annual Achieved: Sum of achieved MCV for all months in current FY
      let totalAnnualAchieved = 0;
      
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
                
                // Check if this month belongs to the current financial year
                // FY months: April (4) to March (3) of next year
                if (monthNum >= 4 && yearNum === fyStartYear) {
                  // April to December of start year
                  totalAnnualAchieved += achievedMcv;
                } else if (monthNum >= 1 && monthNum <= 3 && yearNum === fyEndYear) {
                  // January to March of end year
                  totalAnnualAchieved += achievedMcv;
                }
              }
            });
          }
        });
      }
      
      // Calculate Annual Target: Sum of targets for all months in current FY from monthly_targets table
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
      
      const { data: fyTargets, error: fyTargetsError } = await supabase
        .from("monthly_targets")
        .select("target, month, year")
        .in("month", fyMonthNumbers)
        .in("year", fyYears);
      
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

      // Calculate Quarter Target: Sum of targets for current quarter months from monthly_targets table
      const { data: quarterTargets, error: quarterTargetsError } = await supabase
        .from("monthly_targets")
        .select("target")
        .in("month", quarterMonthsForTarget)
        .eq("year", quarterYearForTarget);

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
      
      if (!mcvError && allMandatesForMcv) {
        allMandatesForMcv.forEach((mandate: any) => {
          const monthlyData = mandate.monthly_data;
          if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
            Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
              if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                // Check if this is the current month
                if (monthYear === currentMonthYear) {
                  const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                  totalCurrentMonthAchieved += achievedMcv;
                }
              }
            });
          }
        });
      }
      
      // Calculate Current Month Target: Get target for current month from monthly_targets table
      const { data: currentMonthTargetData, error: currentMonthTargetError } = await supabase
        .from("monthly_targets")
        .select("target")
        .eq("month", currentMonthNum)
        .eq("year", currentYearNum)
        .single();

      let totalCurrentMonthTarget = 0;
      if (!currentMonthTargetError && currentMonthTargetData) {
        totalCurrentMonthTarget = parseFloat(currentMonthTargetData.target?.toString() || "0") || 0;
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

      // Fetch Funnel Counts for "Funnel Stage_Count of Sales Module"
      const { data: allDeals, error: dealsError } = await supabase
        .from("pipeline_deals" as any)
        .select("status") as any;

      if (!dealsError && allDeals) {
        // Status order matching Pipeline.tsx
        const statusOrder = [
          "Listed",                                    // 1
          "Pre-Appointment Prep Done",                 // 2
          "Discovery Meeting Done",                    // 3
          "Requirement Gathering Done",                 // 4
          "Solution Proposal Made",                    // 5
          "SOW Handshake Done",                        // 6
          "Final Proposal Done",                       // 7
          "Commercial Agreed",                         // 8
          "Closed Won",                                // 9
          "Dropped",                                   // 10
        ];

        // Count deals by status
        const statusCounts: Record<string, number> = {};
        allDeals.forEach((deal: any) => {
          const status = deal.status;
          if (status) {
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          }
        });

        // Calculate TOFU: statuses 1-5 (indices 0-4)
        const tofuStatuses = statusOrder.slice(0, 5);
        const tofu = tofuStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

        // Calculate BOFU: statuses 6-8 (indices 5-7)
        const bofuStatuses = statusOrder.slice(5, 8);
        const bofu = bofuStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

        // Calculate Closed Won: status 9 (index 8)
        const closedWon = statusCounts["Closed Won"] || 0;

        // Calculate Dropped: status 10 (index 9)
        const dropped = statusCounts["Dropped"] || 0;

        setFunnelCounts({ tofu, bofu, closedWon, dropped });
      }

      // Fetch Funnel Revenue for "Funnel Stage_Expected Revenue"
      const { data: allDealsWithRevenue, error: dealsRevenueError } = await supabase
        .from("pipeline_deals" as any)
        .select("status, expected_revenue") as any;

      if (!dealsRevenueError && allDealsWithRevenue) {
        // Status order matching Pipeline.tsx
        const statusOrder = [
          "Listed",                                    // 1
          "Pre-Appointment Prep Done",                 // 2
          "Discovery Meeting Done",                    // 3
          "Requirement Gathering Done",                 // 4
          "Solution Proposal Made",                    // 5
          "SOW Handshake Done",                        // 6
          "Final Proposal Done",                       // 7
          "Commercial Agreed",                         // 8
          "Closed Won",                                // 9
          "Dropped",                                   // 10
        ];

        // Sum expected_revenue by status
        const statusRevenue: Record<string, number> = {};
        allDealsWithRevenue.forEach((deal: any) => {
          const status = deal.status;
          const expectedRevenue = parseFloat(deal.expected_revenue?.toString() || "0") || 0;
          if (status) {
            statusRevenue[status] = (statusRevenue[status] || 0) + expectedRevenue;
          }
        });

        // Calculate TOFU: sum of expected_revenue for statuses 1-5 (indices 0-4)
        const tofuStatuses = statusOrder.slice(0, 5);
        const tofuRevenue = tofuStatuses.reduce((sum, status) => sum + (statusRevenue[status] || 0), 0);

        // Calculate BOFU: sum of expected_revenue for statuses 6-8 (indices 5-7)
        const bofuStatuses = statusOrder.slice(5, 8);
        const bofuRevenue = bofuStatuses.reduce((sum, status) => sum + (statusRevenue[status] || 0), 0);

        // Calculate Closed Won: sum of expected_revenue for status 9 (index 8)
        const closedWonRevenue = statusRevenue["Closed Won"] || 0;

        // Calculate Dropped: sum of expected_revenue for status 10 (index 9)
        const droppedRevenue = statusRevenue["Dropped"] || 0;

        setFunnelRevenue({ 
          tofu: tofuRevenue, 
          bofu: bofuRevenue, 
          closedWon: closedWonRevenue, 
          dropped: droppedRevenue 
        });
      }

      // Calculate MCV Tier and Company Size Tier data
      // Generate month columns from April to current month
      // Note: fyStartMonth, currentMonthNum, currentYearNum, and fyStartYear are already declared above
      
      // Calculate previous month for MCV Tier calculation
      const prevMonthForTier = currentMonthNum - 1;
      const prevYearForTier = currentYearNum;
      let actualPrevMonth = prevMonthForTier;
      let actualPrevYear = prevYearForTier;
      if (prevMonthForTier === 0) {
        actualPrevMonth = 12;
        actualPrevYear = currentYearNum - 1;
      }
      const prevMonthYearForTier = `${actualPrevYear}-${String(actualPrevMonth).padStart(2, '0')}`;
      
      // Generate months from April to current month
      const monthColumns: Array<{ month: number; year: number; key: string; label: string }> = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      if (currentMonthNum >= 4) {
        // Current month is April or later - all months are in current year
        for (let month = fyStartMonth; month <= currentMonthNum; month++) {
          monthColumns.push({
            month,
            year: currentYearNum,
            key: `${currentYearNum}-${String(month).padStart(2, '0')}`,
            label: `${monthNames[month - 1]} ${currentYearNum}`,
          });
        }
      } else {
        // Current month is Jan-Mar - include months from previous year's April to current month
        // April to December of previous year
        for (let month = fyStartMonth; month <= 12; month++) {
          monthColumns.push({
            month,
            year: fyStartYear,
            key: `${fyStartYear}-${String(month).padStart(2, '0')}`,
            label: `${monthNames[month - 1]} ${fyStartYear}`,
          });
        }
        // January to current month of current year
        for (let month = 1; month <= currentMonthNum; month++) {
          monthColumns.push({
            month,
            year: currentYearNum,
            key: `${currentYearNum}-${String(month).padStart(2, '0')}`,
            label: `${monthNames[month - 1]} ${currentYearNum}`,
          });
        }
      }

      // Fetch accounts with their company size tier (MCV Tier will be calculated dynamically)
      const { data: accountsData, error: accountsTierError } = await supabase
        .from("accounts")
        .select("id, company_size_tier")
        .not("company_size_tier", "is", null);

      // Fetch mandates with account_id and monthly_data
      const { data: mandatesTierData, error: mandatesTierError } = await supabase
        .from("mandates")
        .select("account_id, monthly_data");

      // Calculate last month's achieved MCV for each account to determine MCV Tier dynamically
      const accountLastMonthMcv: Record<string, number> = {};
      if (!mandatesTierError && mandatesTierData) {
        mandatesTierData.forEach((mandate: any) => {
          const accountId = mandate.account_id;
          if (!accountId) return;
          
          const monthlyData = mandate.monthly_data;
          if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
            const lastMonthRecord = monthlyData[prevMonthYearForTier];
            if (Array.isArray(lastMonthRecord) && lastMonthRecord.length >= 2) {
              const achievedMcv = parseFloat(lastMonthRecord[1]?.toString() || "0") || 0;
              accountLastMonthMcv[accountId] = (accountLastMonthMcv[accountId] || 0) + achievedMcv;
            }
          }
        });
      }

      // Create account tier map with dynamically calculated MCV Tier
      const accountTierMap: Record<string, { mcvTier: string | null; companySizeTier: string | null }> = {};
      if (accountsData) {
        accountsData.forEach((account: any) => {
          // Calculate MCV Tier dynamically based on last month's achieved MCV
          const lastMonthMcv = accountLastMonthMcv[account.id] || 0;
          const mcvTier = lastMonthMcv > 10000000 ? "Tier 1" : (lastMonthMcv > 0 ? "Tier 2" : null);
          
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
        "Company Size Tier_Tier 1": {},
        "Company Size Tier_Tier 2": {},
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
        "Company Size Tier_Tier 1": {},
        "Company Size Tier_Tier 2": {},
      };

      if (!mandatesTierError && mandatesTierData) {
        mandatesTierData.forEach((mandate: any) => {
          const accountId = mandate.account_id;
          const accountTiers = accountTierMap[accountId];
          
          if (!accountTiers) return;

          const monthlyData = mandate.monthly_data;
          if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
            Object.entries(monthlyData).forEach(([monthYear, monthRecord]: [string, any]) => {
              if (Array.isArray(monthRecord) && monthRecord.length >= 2) {
                const achievedMcv = parseFloat(monthRecord[1]?.toString() || "0") || 0;
                
                // Check if this month is in our month columns
                if (monthColumns.some((col) => col.key === monthYear)) {
                  // Add achieved MCV to the appropriate tier buckets
                  if (accountTiers.mcvTier === "Tier 1") {
                    monthlyTierData["MCV Tier_Tier 1"][monthYear] = (monthlyTierData["MCV Tier_Tier 1"][monthYear] || 0) + achievedMcv;
                  } else if (accountTiers.mcvTier === "Tier 2") {
                    monthlyTierData["MCV Tier_Tier 2"][monthYear] = (monthlyTierData["MCV Tier_Tier 2"][monthYear] || 0) + achievedMcv;
                  }

                  if (accountTiers.companySizeTier === "Tier 1") {
                    monthlyTierData["Company Size Tier_Tier 1"][monthYear] = (monthlyTierData["Company Size Tier_Tier 1"][monthYear] || 0) + achievedMcv;
                  } else if (accountTiers.companySizeTier === "Tier 2") {
                    monthlyTierData["Company Size Tier_Tier 2"][monthYear] = (monthlyTierData["Company Size Tier_Tier 2"][monthYear] || 0) + achievedMcv;
                  }
                }
              }
            });
          }
        });
      }

      // Calculate cumulative values for each tier
      // Process months in order and accumulate
      monthColumns.forEach((col, index) => {
        Object.keys(tierDataMap).forEach((tierKey) => {
          // Get current month's value
          const currentMonthValue = monthlyTierData[tierKey][col.key] || 0;
          
          // Get previous cumulative value (from previous month)
          const prevCumulative = index > 0 
            ? tierDataMap[tierKey][monthColumns[index - 1].key] || 0
            : 0;
          
          // Set cumulative value for this month
          tierDataMap[tierKey][col.key] = prevCumulative + currentMonthValue;
        });
      });

      // Convert to array format for display
      const formattedTierData = [
        {
          category: "MCV Tier",
          tier: "Tier 1",
          ...monthColumns.reduce((acc, col) => {
            const value = tierDataMap["MCV Tier_Tier 1"][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        },
        {
          category: "MCV Tier",
          tier: "Tier 2",
          ...monthColumns.reduce((acc, col) => {
            const value = tierDataMap["MCV Tier_Tier 2"][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        },
        {
          category: "Company Size Tier",
          tier: "Tier 1",
          ...monthColumns.reduce((acc, col) => {
            const value = tierDataMap["Company Size Tier_Tier 1"][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        },
        {
          category: "Company Size Tier",
          tier: "Tier 2",
          ...monthColumns.reduce((acc, col) => {
            const value = tierDataMap["Company Size Tier_Tier 2"][col.key] || 0;
            acc[col.key] = formatCurrency(value);
            return acc;
          }, {} as Record<string, string>),
        },
      ];

      setMcvTierData(formattedTierData);
      setTierMonthColumns(monthColumns);

      setTotalMandates(totalCount || 0);
      setMandatesThisMonth(monthCount || 0);
      setTotalAccounts(accountsCount || 0);
      setAvgAwignShare(average);
      setOverlapFactor(overlap);
      setUpsellGroupB(formattedGroupB);
      setUpsellGroupC(formattedGroupC);
      setUpsellPerformance(formattedPerformance);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };




  // Calculate actualVsTargetAnnual dynamically based on state
  const actualVsTargetAnnual = [
    { name: "Achieved", value: annualAchieved, fill: "#4169E1" },
    { name: "Target", value: annualTarget, fill: "#E0E0E0" },
  ];

  // Calculate actualVsTargetQ2 dynamically based on state
  const actualVsTargetQ2 = [
    { name: "Achieved", value: quarterAchieved, fill: "#4169E1" },
    { name: "Target", value: quarterTarget, fill: "#E0E0E0" },
  ];

  // Calculate actualVsTargetCurrent dynamically based on state
  const actualVsTargetCurrent = [
    { name: "Achieved", value: currentMonthAchieved, fill: "#4169E1" },
    { name: "Target", value: currentMonthTarget, fill: "#E0E0E0" },
  ];

  const formatCurrency = (value: number | string): string => {
    if (typeof value === "string") return value;
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-6 p-6">
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
                <p className="text-xs text-muted-foreground mt-2">{mandatesThisMonth} created this month</p>
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
                <p className="text-base font-bold mb-2">MCV Planned</p>
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
                <p className="text-base font-bold mb-2">FFM Achieved</p>
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
                    return `${fyString} (${ffmAchievedFyPercentage.toFixed(1)}% of MCV Planned)`;
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
                <p className="text-base font-bold mb-2">MCV This Quarter</p>
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
                  {totalMandates} mandates - {totalAccounts} accounts
                </p>
                <p className="text-xs text-muted-foreground">multiple mandates per account</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MCV Tier and Company Size Tier Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>MCV Tier and Company Size Tier</CardTitle>
            <div className="flex gap-2">
              <Select value={mcvTierFilter} onValueChange={setMcvTierFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="MCV Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MCV Tiers</SelectItem>
                  <SelectItem value="tier1">Tier 1</SelectItem>
                  <SelectItem value="tier2">Tier 2</SelectItem>
                </SelectContent>
              </Select>
              <Select value={companySizeTierFilter} onValueChange={setCompanySizeTierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Company Size Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Company Size Tiers</SelectItem>
                  <SelectItem value="tier1">Tier 1</SelectItem>
                  <SelectItem value="tier2">Tier 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
                  <TableHead>Tier / Condition</TableHead>
                  {tierMonthColumns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Filter the data based on selected filters
                  // Each filter only affects its own category
                  const filteredData = mcvTierData.filter((row) => {
                    if (row.category === "MCV Tier") {
                      // MCV Tier rows: only filter by MCV Tier filter
                      if (mcvTierFilter === "all") return true;
                      return (mcvTierFilter === "tier1" && row.tier === "Tier 1") || 
                             (mcvTierFilter === "tier2" && row.tier === "Tier 2");
                    } else if (row.category === "Company Size Tier") {
                      // Company Size Tier rows: only filter by Company Size Tier filter
                      if (companySizeTierFilter === "all") return true;
                      return (companySizeTierFilter === "tier1" && row.tier === "Tier 1") || 
                             (companySizeTierFilter === "tier2" && row.tier === "Tier 2");
                    }
                    return true;
                  });
                  
                  if (filteredData.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={tierMonthColumns.length + 2} className="text-center text-muted-foreground py-8">
                          No data available
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return filteredData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.tier}</TableCell>
                      {tierMonthColumns.map((col) => (
                        <TableCell key={col.key}>
                          {row[col.key] || "₹0"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upsell Tables - Group B and Group C */}
      <div className="space-y-4">
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
          <div className="flex items-center justify-between">
            <CardTitle>Upsell Performance</CardTitle>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="MCV Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="tier1">Tier 1</SelectItem>
                <SelectItem value="tier2">Tier 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

      {/* Performance Dashboard Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Performance Dashboard</h2>
          
          {/* Filters */}
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

            {/* Cross Sell and Upsell Status Filter */}
            <Select value={filterUpsellStatus} onValueChange={(value) => setFilterUpsellStatus(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Cross Sell & Upsell Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="Ongoing">Ongoing</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
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

        {/* FY26 Actual vs Target Charts - Annual and Q2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Annual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {(() => {
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonth = now.getMonth() + 1;
                  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
                  const fyEndYear = (fyStartYear + 1).toString().slice(-2);
                  return `FY${fyEndYear} Actual vs Target (Annual)`;
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
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={actualVsTargetAnnual} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {actualVsTargetAnnual.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm">Target: {formatCurrency(annualTarget)}</p>
                    <p className="text-sm">Achieved: {formatCurrency(annualAchieved)}</p>
                    <p className="text-sm font-medium">
                      {annualTarget > 0 
                        ? `${((annualAchieved / annualTarget) * 100).toFixed(1)}% of Target`
                        : "N/A"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Current Quarter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {(() => {
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonth = now.getMonth() + 1;
                  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
                  const fyEndYear = (fyStartYear + 1).toString().slice(-2);
                  
                  // Determine current quarter
                  let quarterLabel = "";
                  if (currentMonth >= 4 && currentMonth <= 6) {
                    quarterLabel = "Q1";
                  } else if (currentMonth >= 7 && currentMonth <= 9) {
                    quarterLabel = "Q2";
                  } else if (currentMonth >= 10 && currentMonth <= 12) {
                    quarterLabel = "Q3";
                  } else {
                    quarterLabel = "Q4";
                  }
                  
                  return `FY${fyEndYear} Actual vs Target (${quarterLabel})`;
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
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={actualVsTargetQ2} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {actualVsTargetQ2.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm">Target: {formatCurrency(quarterTarget)}</p>
                    <p className="text-sm">Achieved: {formatCurrency(quarterAchieved)}</p>
                    <p className="text-sm font-medium">
                      {quarterTarget > 0 
                        ? `${((quarterAchieved / quarterTarget) * 100).toFixed(1)}% of Target`
                        : "N/A"}
                    </p>
                  </div>
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
              <CardTitle className="text-base">
                {(() => {
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonth = now.getMonth() + 1;
                  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
                  const fyEndYear = (fyStartYear + 1).toString().slice(-2);
                  const monthName = now.toLocaleString('default', { month: 'long' });
                  return `FY${fyEndYear} Actual vs Target (${monthName})`;
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
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={actualVsTargetCurrent} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {actualVsTargetCurrent.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm">Target: {formatCurrency(currentMonthTarget)}</p>
                    <p className="text-sm">Achieved: {formatCurrency(currentMonthAchieved)}</p>
                    <p className="text-sm font-medium">
                      {currentMonthTarget > 0 
                        ? `${((currentMonthAchieved / currentMonthTarget) * 100).toFixed(1)}% of Target`
                        : "N/A"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Dropped Sales and Reasons */}
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
                        
                        const RADIAN = Math.PI / 180;
                        // Point on the outer edge of the pie segment
                        const radius = outerRadius;
                        const xLabel = cx + radius * Math.cos(-midAngle * RADIAN);
                        const yLabel = cy + radius * Math.sin(-midAngle * RADIAN);
                        
                        // Calculate label position (outside the pie with gap)
                        const gap = 15; // Gap between line end and text
                        const labelRadius = outerRadius + 30;
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
                            {/* Label text - reason name */}
                            <text
                              x={labelX}
                              y={labelY}
                              textAnchor={textAnchor}
                              fill={fill}
                              fontSize={14}
                              fontWeight={500}
                              dy={-8}
                            >
                              {capitalizedName}
                            </text>
                            {/* Label text - count and percentage */}
                            <text
                              x={labelX}
                              y={labelY}
                              textAnchor={textAnchor}
                              fill={fill}
                              fontSize={13}
                              dy={8}
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
              )}
            </CardContent>
          </Card>
      </div>

        {/* LoB Sales Performance Comparison - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle>LoB Sales Performance Comparison</CardTitle>
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
              <ResponsiveContainer width="100%" height={500}>
                <BarChart 
                  data={lobSalesPerformance}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  barCategoryGap="20%"
                  barGap={0}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="lob" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    domain={[0, 'auto']}
                    allowDataOverflow={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => {
                      if (value >= 10000000) {
                        return `₹${(value / 10000000).toFixed(2)}Cr`;
                      } else if (value >= 100000) {
                        return `₹${(value / 100000).toFixed(1)}L`;
                      } else {
                        return `₹${value.toLocaleString("en-IN")}`;
                      }
                    }}
                    cursor={false}
                  />
                  <Legend />
                  {/* Render both bars without stacking - they'll overlap starting from 0 */}
                  {/* Render the higher value bar first, then the lower value bar on top */}
                  <Bar 
                    dataKey="targetMpv" 
                    fill="#E0E0E0" 
                    name="Target MPV" 
                    barSize={40}
                    activeBar={false}
                    isAnimationActive={false}
                  />
                  <Bar 
                    dataKey="achievedMpv" 
                    fill="#4169E1" 
                    name="Achieved MPV" 
                    barSize={40}
                    activeBar={false}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FY26 Annual Sales Target - Individual */}
      <Card>
        <CardHeader>
          <CardTitle>FY26 Annual Sales Target - Individual</CardTitle>
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
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={kamSalesPerformance}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="kamName" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 'auto']}
                  allowDataOverflow={false}
                />
                <Tooltip 
                  formatter={(value: number) => {
                    if (value >= 10000000) {
                      return `₹${(value / 10000000).toFixed(2)}Cr`;
                    } else if (value >= 100000) {
                      return `₹${(value / 100000).toFixed(1)}L`;
                    } else {
                      return `₹${value.toLocaleString("en-IN")}`;
                    }
                  }}
                  cursor={false}
                />
                <Legend />
                {/* Render both bars without stacking - they'll overlap starting from 0 */}
                <Bar 
                  dataKey="targetMpv" 
                  fill="#E0E0E0" 
                  name="Target MPV" 
                  barSize={40}
                  activeBar={false}
                  isAnimationActive={false}
                />
                <Bar 
                  dataKey="achievedMpv" 
                  fill="#4169E1" 
                  name="Achieved MPV" 
                  barSize={40}
                  activeBar={false}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Funnel Stage and Activity Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Funnel Stage_Count of Sales Module */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel Stage_Count of Sales Module</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {(() => {
                const values = { 
                  tofu: funnelCounts.tofu, 
                  bofu: funnelCounts.bofu, 
                  closedWon: funnelCounts.closedWon, 
                  dropped: funnelCounts.dropped 
                };
                const maxValue = Math.max(...Object.values(values), 1); // Use 1 as minimum to avoid division by zero
                const maxWidth = 200; // Maximum line width in pixels
                
                const calculateWidth = (value: number) => {
                  return (value / maxValue) * maxWidth;
                };
                
                return (
                  <>
                    {/* Left Section - Lines */}
                    <div className="flex flex-col items-start relative">
                      {(() => {
                        const barHeight = 1;
                        const gapBetweenBars = 60; // Increased from 40px
                        const gapBetweenDuplicates = 8; // Kept same
                        const squareSize = calculateWidth(values.dropped);
                        
                        // Calculate Y positions for each bar
                        const y1Top = 0;
                        const y1Bottom = barHeight;
                        const y2Top = y1Bottom + gapBetweenBars;
                        const y2Bottom = y2Top + barHeight;
                        const y3Top = y2Bottom + gapBetweenDuplicates;
                        const y3Bottom = y3Top + barHeight;
                        const y4Top = y3Bottom + gapBetweenBars;
                        const y4Bottom = y4Top + barHeight;
                        const y5Top = y4Bottom + gapBetweenDuplicates;
                        const y5Bottom = y5Top + barHeight;
                        const y6Top = y5Bottom + gapBetweenBars;
                        const y6Bottom = y6Top + barHeight;
                        const squareY = y6Bottom + 8; // Reduced gap to 8px
                        const totalHeight = squareY + squareSize;
                        
                        return (
                          <svg className="absolute top-0 left-0" style={{ width: `${maxWidth}px`, height: `${totalHeight}px`, pointerEvents: 'none' }}>
                            {/* Green funnel segment: Line 1 to Line 2 */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.tofu) / 2},${y1Top}
                                ${maxWidth / 2 + calculateWidth(values.tofu) / 2},${y1Top}
                                ${maxWidth / 2 + calculateWidth(values.bofu) / 2},${y2Bottom}
                                ${maxWidth / 2 - calculateWidth(values.bofu) / 2},${y2Bottom}
                              `}
                              fill="#4ade80"
                            />
                            
                            {/* Light blue funnel segment: Line 3 to Line 4 */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.bofu) / 2},${y3Top}
                                ${maxWidth / 2 + calculateWidth(values.bofu) / 2},${y3Top}
                                ${maxWidth / 2 + calculateWidth(values.closedWon) / 2},${y4Bottom}
                                ${maxWidth / 2 - calculateWidth(values.closedWon) / 2},${y4Bottom}
                              `}
                              fill="#93c5fd"
                            />
                            
                            {/* Dark blue funnel segment: Line 5 to Line 6 */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.closedWon) / 2},${y5Top}
                                ${maxWidth / 2 + calculateWidth(values.closedWon) / 2},${y5Top}
                                ${maxWidth / 2 + calculateWidth(values.dropped) / 2},${y6Bottom}
                                ${maxWidth / 2 - calculateWidth(values.dropped) / 2},${y6Bottom}
                              `}
                              fill="#2563eb"
                            />
                            
                            {/* Line 1: TOFU */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.tofu) / 2}
                              y={y1Top}
                              width={calculateWidth(values.tofu)}
                              height={barHeight}
                              fill="#4ade80"
                            />
                            
                            {/* Line 2: BOFU's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.bofu) / 2}
                              y={y2Top}
                              width={calculateWidth(values.bofu)}
                              height={barHeight}
                              fill="#4ade80"
                            />
                            
                            {/* Line 3: BOFU's 2nd */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.bofu) / 2}
                              y={y3Top}
                              width={calculateWidth(values.bofu)}
                              height={barHeight}
                              fill="#93c5fd"
                            />
                            
                            {/* Line 4: Closed Won's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.closedWon) / 2}
                              y={y4Top}
                              width={calculateWidth(values.closedWon)}
                              height={barHeight}
                              fill="#93c5fd"
                            />
                            
                            {/* Line 5: Closed Won's 2nd */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.closedWon) / 2}
                              y={y5Top}
                              width={calculateWidth(values.closedWon)}
                              height={barHeight}
                              fill="#2563eb"
                            />
                            
                            {/* Line 6: Dropped's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.dropped) / 2}
                              y={y6Top}
                              width={calculateWidth(values.dropped)}
                              height={barHeight}
                              fill="#2563eb"
                            />
                            
                            {/* Square at the bottom with side length equal to dropped value */}
                            <rect
                              x={maxWidth / 2 - squareSize / 2}
                              y={squareY}
                              width={squareSize}
                              height={squareSize}
                              fill="#facc15"
                            />
                          </svg>
                        );
                      })()}
                    </div>
                    
                    {/* Right Section - Labels */}
                    {(() => {
                      const barHeight = 1;
                      const gapBetweenBars = 60;
                      const gapBetweenDuplicates = 8;
                      const squareSize = calculateWidth(values.dropped);
                      
                      // Calculate Y positions for each bar
                      const y1Top = 0;
                      const y1Bottom = barHeight;
                      const y2Top = y1Bottom + gapBetweenBars;
                      const y2Bottom = y2Top + barHeight;
                      const y3Top = y2Bottom + gapBetweenDuplicates;
                      const y3Bottom = y3Top + barHeight;
                      const y4Top = y3Bottom + gapBetweenBars;
                      const y4Bottom = y4Top + barHeight;
                      const y5Top = y4Bottom + gapBetweenDuplicates;
                      const y5Bottom = y5Top + barHeight;
                      const y6Top = y5Bottom + gapBetweenBars;
                      const y6Bottom = y6Top + barHeight;
                      const squareY = y6Bottom + 8;
                      
                      // Calculate vertical centers of each colored shape
                      const greenShapeCenter = (y1Top + y2Bottom) / 2;
                      const lightBlueShapeCenter = (y3Top + y4Bottom) / 2;
                      const darkBlueShapeCenter = (y5Top + y6Bottom) / 2;
                      const yellowSquareCenter = squareY + squareSize / 2;
                      
                      return (
                        <div className="flex flex-col relative ml-auto" style={{ height: `${squareY + squareSize}px` }}>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${greenShapeCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            TOFU : <span className="font-bold">{values.tofu}</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${lightBlueShapeCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            BOFU : <span className="font-bold">{values.bofu}</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${darkBlueShapeCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            Closed Won : <span className="font-bold">{values.closedWon}</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${yellowSquareCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            Dropped : <span className="font-bold">{values.dropped}</span>
                          </span>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Funnel Stage_Expected Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel Stage_Expected Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {(() => {
                // Convert revenue from rupees to lakhs (divide by 100000)
                const values = { 
                  tofu: funnelRevenue.tofu / 100000, 
                  bofu: funnelRevenue.bofu / 100000, 
                  closedWon: funnelRevenue.closedWon / 100000, 
                  dropped: funnelRevenue.dropped / 100000 
                };
                const maxValue = Math.max(...Object.values(values), 1); // Use 1 as minimum to avoid division by zero
                const maxWidth = 200; // Maximum line width in pixels
                
                const calculateWidth = (value: number) => {
                  return (value / maxValue) * maxWidth;
                };
                
                return (
                  <>
                    {/* Left Section - Lines */}
                    <div className="flex flex-col items-start relative">
                      {(() => {
                        const barHeight = 1;
                        const gapBetweenBars = 60; // Increased from 40px
                        const gapBetweenDuplicates = 8; // Kept same
                        const squareSize = calculateWidth(values.dropped);
                        
                        // Calculate Y positions for each bar
                        const y1Top = 0;
                        const y1Bottom = barHeight;
                        const y2Top = y1Bottom + gapBetweenBars;
                        const y2Bottom = y2Top + barHeight;
                        const y3Top = y2Bottom + gapBetweenDuplicates;
                        const y3Bottom = y3Top + barHeight;
                        const y4Top = y3Bottom + gapBetweenBars;
                        const y4Bottom = y4Top + barHeight;
                        const y5Top = y4Bottom + gapBetweenDuplicates;
                        const y5Bottom = y5Top + barHeight;
                        const y6Top = y5Bottom + gapBetweenBars;
                        const y6Bottom = y6Top + barHeight;
                        const squareY = y6Bottom + 8; // Reduced gap to 8px
                        const totalHeight = squareY + squareSize;
                        
                        return (
                          <svg className="absolute top-0 left-0" style={{ width: `${maxWidth}px`, height: `${totalHeight}px`, pointerEvents: 'none' }}>
                            {/* Green funnel segment: Line 1 to Line 2 */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.tofu) / 2},${y1Top}
                                ${maxWidth / 2 + calculateWidth(values.tofu) / 2},${y1Top}
                                ${maxWidth / 2 + calculateWidth(values.bofu) / 2},${y2Bottom}
                                ${maxWidth / 2 - calculateWidth(values.bofu) / 2},${y2Bottom}
                              `}
                              fill="#4ade80"
                            />
                            
                            {/* Light blue funnel segment: Line 3 to Line 4 */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.bofu) / 2},${y3Top}
                                ${maxWidth / 2 + calculateWidth(values.bofu) / 2},${y3Top}
                                ${maxWidth / 2 + calculateWidth(values.closedWon) / 2},${y4Bottom}
                                ${maxWidth / 2 - calculateWidth(values.closedWon) / 2},${y4Bottom}
                              `}
                              fill="#93c5fd"
                            />
                            
                            {/* Dark blue funnel segment: Line 5 to Line 6 */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.closedWon) / 2},${y5Top}
                                ${maxWidth / 2 + calculateWidth(values.closedWon) / 2},${y5Top}
                                ${maxWidth / 2 + calculateWidth(values.dropped) / 2},${y6Bottom}
                                ${maxWidth / 2 - calculateWidth(values.dropped) / 2},${y6Bottom}
                              `}
                              fill="#2563eb"
                            />
                            
                            {/* Line 1: TOFU */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.tofu) / 2}
                              y={y1Top}
                              width={calculateWidth(values.tofu)}
                              height={barHeight}
                              fill="#4ade80"
                            />
                            
                            {/* Line 2: BOFU's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.bofu) / 2}
                              y={y2Top}
                              width={calculateWidth(values.bofu)}
                              height={barHeight}
                              fill="#4ade80"
                            />
                            
                            {/* Line 3: BOFU's 2nd */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.bofu) / 2}
                              y={y3Top}
                              width={calculateWidth(values.bofu)}
                              height={barHeight}
                              fill="#93c5fd"
                            />
                            
                            {/* Line 4: Closed Won's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.closedWon) / 2}
                              y={y4Top}
                              width={calculateWidth(values.closedWon)}
                              height={barHeight}
                              fill="#93c5fd"
                            />
                            
                            {/* Line 5: Closed Won's 2nd */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.closedWon) / 2}
                              y={y5Top}
                              width={calculateWidth(values.closedWon)}
                              height={barHeight}
                              fill="#2563eb"
                            />
                            
                            {/* Line 6: Dropped's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.dropped) / 2}
                              y={y6Top}
                              width={calculateWidth(values.dropped)}
                              height={barHeight}
                              fill="#2563eb"
                            />
                            
                            {/* Square at the bottom with side length equal to dropped value */}
                            <rect
                              x={maxWidth / 2 - squareSize / 2}
                              y={squareY}
                              width={squareSize}
                              height={squareSize}
                              fill="#facc15"
                            />
                          </svg>
                        );
                      })()}
                    </div>
                    
                    {/* Right Section - Labels */}
                    {(() => {
                      const barHeight = 1;
                      const gapBetweenBars = 60;
                      const gapBetweenDuplicates = 8;
                      const squareSize = calculateWidth(values.dropped);
                      
                      // Calculate Y positions for each bar
                      const y1Top = 0;
                      const y1Bottom = barHeight;
                      const y2Top = y1Bottom + gapBetweenBars;
                      const y2Bottom = y2Top + barHeight;
                      const y3Top = y2Bottom + gapBetweenDuplicates;
                      const y3Bottom = y3Top + barHeight;
                      const y4Top = y3Bottom + gapBetweenBars;
                      const y4Bottom = y4Top + barHeight;
                      const y5Top = y4Bottom + gapBetweenDuplicates;
                      const y5Bottom = y5Top + barHeight;
                      const y6Top = y5Bottom + gapBetweenBars;
                      const y6Bottom = y6Top + barHeight;
                      const squareY = y6Bottom + 8;
                      
                      // Calculate vertical centers of each colored shape
                      const greenShapeCenter = (y1Top + y2Bottom) / 2;
                      const lightBlueShapeCenter = (y3Top + y4Bottom) / 2;
                      const darkBlueShapeCenter = (y5Top + y6Bottom) / 2;
                      const yellowSquareCenter = squareY + squareSize / 2;
                      
                      return (
                        <div className="flex flex-col relative ml-auto" style={{ height: `${squareY + squareSize}px` }}>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${greenShapeCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            TOFU : <span className="font-bold">₹{values.tofu.toFixed(1)}L</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${lightBlueShapeCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            BOFU : <span className="font-bold">₹{values.bofu.toFixed(1)}L</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${darkBlueShapeCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            Closed Won : <span className="font-bold">₹{values.closedWon.toFixed(1)}L</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${yellowSquareCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            Dropped : <span className="font-bold">₹{values.dropped.toFixed(1)}L</span>
                          </span>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Meetings and Proposals Metrics */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">0</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Meetings Done Last Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">0</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Meetings Done This Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">0</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Proposal Made Last Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">0</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Proposal Made This Week</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Conversion Table by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Table by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Cumulative # of Records</TableHead>
                <TableHead>CVR to next status</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Dropped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : conversionTableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No data available for {filterFinancialYear}
                  </TableCell>
                </TableRow>
              ) : (
                conversionTableData.map((row, idx) => {
                  const maxRecords = row.maxRecords || row.records || 1;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.status}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{row.records}</span>
                          <div className="flex-1 bg-orange-100 h-4 rounded relative">
                            <div
                              className="bg-orange-500 h-full rounded"
                              style={{ width: `${(row.records / maxRecords) * 100}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{row.cvr}</TableCell>
                      <TableCell>{row.remaining}</TableCell>
                      <TableCell>{row.dropped}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
