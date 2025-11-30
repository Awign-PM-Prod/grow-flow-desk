import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import * as d3 from "d3";

export default function CrossSellDashboard() {
  const [loading, setLoading] = useState(true);
  const [conversionTableData, setConversionTableData] = useState<Array<{
    status: string;
    records: number;
    mcv: number;
    cvr: string;
    remaining: number;
    dropped: number;
    maxRecords?: number;
  }>>([]);
  const [funnelCounts, setFunnelCounts] = useState<{
    tofu: number;
    mofu: number;
    bofu: number;
    closedWon: number;
    dropped: number;
  }>({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
  const [funnelRevenue, setFunnelRevenue] = useState<{
    tofu: number;
    mofu: number;
    bofu: number;
    closedWon: number;
    dropped: number;
  }>({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
  const [totalDealsCount, setTotalDealsCount] = useState<number>(0);
  
  // Chart refs for D3
  const countChartRef = useRef<HTMLDivElement>(null);
  const revenueChartRef = useRef<HTMLDivElement>(null);
  
  // Meetings and Proposals Metrics
  const [meetingsDoneLastWeek, setMeetingsDoneLastWeek] = useState<number>(0);
  const [meetingsDoneThisWeek, setMeetingsDoneThisWeek] = useState<number>(0);
  const [proposalMadeLastWeek, setProposalMadeLastWeek] = useState<number>(0);
  const [proposalMadeThisWeek, setProposalMadeThisWeek] = useState<number>(0);
  
  // Filter states
  const [performanceDashboardFY, setPerformanceDashboardFY] = useState<string>(() => {
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
  const [filterKam, setFilterKam] = useState<string>("");
  const [kams, setKams] = useState<Array<{ id: string; full_name: string }>>([]);
  const [kamSearch, setKamSearch] = useState("");
  const [filterExpectedContractSignMonth, setFilterExpectedContractSignMonth] = useState<string>("");

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

  // Helper function to get the year for a month within the selected FY
  // FY runs from April (month 4) to March (month 3)
  // If month is 1-3, it's in the second year of the FY
  // If month is 4-12, it's in the first year of the FY
  const getYearForMonthInFY = (month: number, fyString: string): number => {
    const fyDateRange = getFinancialYearDateRange(fyString);
    const fyStartYear = fyDateRange.start.getFullYear();
    
    // Months 1-3 (Jan-Mar) are in the second year of FY
    // Months 4-12 (Apr-Dec) are in the first year of FY
    if (month >= 1 && month <= 3) {
      return fyStartYear + 1;
    } else {
      return fyStartYear;
    }
  };

  const fetchMeetingsAndProposalsData = async () => {
    try {
      // Get financial year date range from Performance Dashboard FY filter
      const perfFyDateRange = getFinancialYearDateRange(performanceDashboardFY);
      
      // Get filtered deal IDs first
      let dealsQuery = supabase
        .from("pipeline_deals" as any)
        .select("id, kam_id, expected_contract_sign_date")
        .gte("created_at", perfFyDateRange.start.toISOString())
        .lte("created_at", perfFyDateRange.end.toISOString());

      if (filterKam) {
        dealsQuery = dealsQuery.eq("kam_id", filterKam);
      }

      if (filterExpectedContractSignMonth) {
        const month = parseInt(filterExpectedContractSignMonth);
        const year = getYearForMonthInFY(month, performanceDashboardFY);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        dealsQuery = dealsQuery
          .gte("expected_contract_sign_date", startDate.toISOString().split("T")[0])
          .lte("expected_contract_sign_date", endDate.toISOString().split("T")[0]);
      }

      const { data: filteredDeals } = await dealsQuery as any;
      const filteredDealIds = filteredDeals ? filteredDeals.map((d: any) => d.id) : [];
      
      const now = new Date();
      
      // Calculate current week (Monday to Sunday)
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert Sunday (0) to 6
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - daysFromMonday);
      currentWeekStart.setHours(0, 0, 0, 0);
      
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      currentWeekEnd.setHours(23, 59, 59, 999);
      
      // Calculate last week (previous Monday to Sunday)
      const lastWeekEnd = new Date(currentWeekStart);
      lastWeekEnd.setDate(currentWeekStart.getDate() - 1);
      lastWeekEnd.setHours(23, 59, 59, 999);
      
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
      lastWeekStart.setHours(0, 0, 0, 0);
      
      // Calculate effective week ranges (intersection of week range and FY range)
      const effectiveLastWeekStart = lastWeekStart < perfFyDateRange.start ? perfFyDateRange.start : lastWeekStart;
      const effectiveLastWeekEnd = lastWeekEnd > perfFyDateRange.end ? perfFyDateRange.end : lastWeekEnd;
      const effectiveCurrentWeekStart = currentWeekStart < perfFyDateRange.start ? perfFyDateRange.start : currentWeekStart;
      const effectiveCurrentWeekEnd = currentWeekEnd > perfFyDateRange.end ? perfFyDateRange.end : currentWeekEnd;
      
      // Only query if the effective date range is valid (start <= end)
      const hasValidLastWeek = effectiveLastWeekStart <= effectiveLastWeekEnd;
      const hasValidCurrentWeek = effectiveCurrentWeekStart <= effectiveCurrentWeekEnd;
      
      // Fetch meetings done last week (within selected FY and filtered deals)
      let meetingsLastWeekCount = 0;
      if (hasValidLastWeek) {
        let query = supabase
          .from("deal_status_history")
          .select("*", { count: "exact", head: true })
          .eq("new_status", "Discovery Meeting Done")
          .gte("changed_at", effectiveLastWeekStart.toISOString())
          .lte("changed_at", effectiveLastWeekEnd.toISOString());
        
        if (filteredDealIds.length > 0) {
          query = query.in("deal_id", filteredDealIds);
        } else {
          query = query.eq("deal_id", "no-match");
        }
        
        const { count } = await query;
        meetingsLastWeekCount = count || 0;
      }
      
      // Fetch meetings done this week (within selected FY and filtered deals)
      let meetingsThisWeekCount = 0;
      if (hasValidCurrentWeek) {
        let query = supabase
          .from("deal_status_history")
          .select("*", { count: "exact", head: true })
          .eq("new_status", "Discovery Meeting Done")
          .gte("changed_at", effectiveCurrentWeekStart.toISOString())
          .lte("changed_at", effectiveCurrentWeekEnd.toISOString());
        
        if (filteredDealIds.length > 0) {
          query = query.in("deal_id", filteredDealIds);
        } else {
          query = query.eq("deal_id", "no-match");
        }
        
        const { count } = await query;
        meetingsThisWeekCount = count || 0;
      }
      
      // Fetch proposals made last week (within selected FY and filtered deals)
      let proposalsLastWeekCount = 0;
      if (hasValidLastWeek) {
        let query = supabase
          .from("deal_status_history")
          .select("*", { count: "exact", head: true })
          .eq("new_status", "Solution Proposal Made")
          .gte("changed_at", effectiveLastWeekStart.toISOString())
          .lte("changed_at", effectiveLastWeekEnd.toISOString());
        
        if (filteredDealIds.length > 0) {
          query = query.in("deal_id", filteredDealIds);
        } else {
          query = query.eq("deal_id", "no-match");
        }
        
        const { count } = await query;
        proposalsLastWeekCount = count || 0;
      }
      
      // Fetch proposals made this week (within selected FY and filtered deals)
      let proposalsThisWeekCount = 0;
      if (hasValidCurrentWeek) {
        let query = supabase
          .from("deal_status_history")
          .select("*", { count: "exact", head: true })
          .eq("new_status", "Solution Proposal Made")
          .gte("changed_at", effectiveCurrentWeekStart.toISOString())
          .lte("changed_at", effectiveCurrentWeekEnd.toISOString());
        
        if (filteredDealIds.length > 0) {
          query = query.in("deal_id", filteredDealIds);
        } else {
          query = query.eq("deal_id", "no-match");
        }
        
        const { count } = await query;
        proposalsThisWeekCount = count || 0;
      }
      
      setMeetingsDoneLastWeek(meetingsLastWeekCount || 0);
      setMeetingsDoneThisWeek(meetingsThisWeekCount || 0);
      setProposalMadeLastWeek(proposalsLastWeekCount || 0);
      setProposalMadeThisWeek(proposalsThisWeekCount || 0);
    } catch (error) {
      console.error("Error fetching meetings and proposals data:", error);
    }
  };

  const fetchConversionTableData = async () => {
    try {
      // Get financial year date range from Performance Dashboard FY filter
      const perfFyDateRange = getFinancialYearDateRange(performanceDashboardFY);
      
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

      // Build base query for pipeline_deals with filters
      let dealsQuery = supabase
        .from("pipeline_deals" as any)
        .select("id, status, created_at, mcv, kam_id, expected_contract_sign_date")
        .gte("created_at", perfFyDateRange.start.toISOString())
        .lte("created_at", perfFyDateRange.end.toISOString());

      // Apply KAM filter
      if (filterKam) {
        dealsQuery = dealsQuery.eq("kam_id", filterKam);
      }

      // Apply Expected Contract Signing month filter
      if (filterExpectedContractSignMonth) {
        const month = parseInt(filterExpectedContractSignMonth);
        const year = getYearForMonthInFY(month, performanceDashboardFY);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        dealsQuery = dealsQuery
          .gte("expected_contract_sign_date", startDate.toISOString().split("T")[0])
          .lte("expected_contract_sign_date", endDate.toISOString().split("T")[0]);
      }

      // Fetch current deals to handle deals that might not have history yet (newly created with "Listed" status)
      // Filter by created_at within selected FY
      // Also fetch mcv to calculate MCV per status
      const { data: currentDeals, error: dealsError } = await dealsQuery as any;

      if (dealsError) throw dealsError;

      // Get filtered deal IDs
      const filteredDealIds = currentDeals ? currentDeals.map((d: any) => d.id) : [];

      // Fetch all status history records to track all statuses each deal has been in
      // Filter by created_at within selected FY and deal IDs
      let allStatusHistoryQuery = supabase
        .from("deal_status_history" as any)
        .select("deal_id, old_status, new_status, created_at")
        .gte("created_at", perfFyDateRange.start.toISOString())
        .lte("created_at", perfFyDateRange.end.toISOString());

      if (filteredDealIds.length > 0) {
        allStatusHistoryQuery = allStatusHistoryQuery.in("deal_id", filteredDealIds);
      } else {
        // If no deals match filters, return empty result
        allStatusHistoryQuery = allStatusHistoryQuery.eq("deal_id", "no-match");
      }

      const { data: allStatusHistory, error: historyError } = await allStatusHistoryQuery as any;

      if (historyError) throw historyError;

      // Create a map of deal_id to mcv for quick lookup
      const dealMcvMap: Record<string, number> = {};
      if (currentDeals) {
        currentDeals.forEach((deal: any) => {
          const mcv = parseFloat(deal.mcv?.toString() || "0") || 0;
          dealMcvMap[deal.id] = mcv;
        });
      }

      // Track unique deals per status using Sets
      // A deal is counted in a status if it appears in old_status or new_status in history
      const statusDealSets: Record<string, Set<string>> = {};
      
      // Track MCV per status
      const statusMcv: Record<string, number> = {};
      
      // Initialize all statuses with empty Sets and zero MCV
      statusOrder.forEach((status) => {
        statusDealSets[status] = new Set<string>();
        statusMcv[status] = 0;
      });

      // Process all status history records
      if (allStatusHistory) {
        allStatusHistory.forEach((history: any) => {
          const dealId = history.deal_id;
          const dealMcv = dealMcvMap[dealId] || 0;
          
          // Count deal in new_status (the status it moved to)
          if (history.new_status && statusDealSets.hasOwnProperty(history.new_status)) {
            if (!statusDealSets[history.new_status].has(dealId)) {
              statusDealSets[history.new_status].add(dealId);
              statusMcv[history.new_status] += dealMcv;
            }
          }
          
          // Count deal in old_status (the status it moved from)
          if (history.old_status && statusDealSets.hasOwnProperty(history.old_status)) {
            if (!statusDealSets[history.old_status].has(dealId)) {
              statusDealSets[history.old_status].add(dealId);
              statusMcv[history.old_status] += dealMcv;
            }
          }
        });
      }

      // Handle deals that are currently "Listed" but might not have history yet
      // (newly created deals start with "Listed" status)
      if (currentDeals) {
        currentDeals.forEach((deal: any) => {
          const status = deal.status;
          const dealMcv = dealMcvMap[deal.id] || 0;
          // If deal is "Listed" and not in the Set yet, add it
          // This handles newly created deals that haven't had their status changed yet
          if (status === "Listed" && statusDealSets["Listed"]) {
            if (!statusDealSets["Listed"].has(deal.id)) {
              statusDealSets["Listed"].add(deal.id);
              statusMcv["Listed"] += dealMcv;
            }
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
        
        // Calculate CVR: next status records / current status records (based on Cumulative # of Records only)
        let cvr = "-";
        if (index < statusOrderWithoutDropped.length - 1) {
          const nextStatus = statusOrderWithoutDropped[index + 1];
          const nextCount = statusCounts[nextStatus] || 0;
          
          if (count > 0) {
            const cvrValue = (nextCount / count) * 100;
            cvr = `${cvrValue.toFixed(1)}%`;
          } else if (nextCount > 0 && count === 0) {
            // If current status has 0 records but next has records, show as "N/A"
            cvr = "N/A";
          }
        }

        return {
          status: `${index}. ${status}`,
          records: count,
          mcv: statusMcv[status] || 0,
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

  const fetchFunnelData = async () => {
    try {
      setLoading(true);
      
      // Reset counts to zero at the start to clear previous data
      setFunnelCounts({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
      setFunnelRevenue({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
      setTotalDealsCount(0);
      
      // Get financial year date range from Performance Dashboard FY filter
      const perfFyDateRange = getFinancialYearDateRange(performanceDashboardFY);
      
      // Build base query for pipeline_deals with filters
      let dealsQuery = supabase
        .from("pipeline_deals" as any)
        .select("id, status, created_at, kam_id, expected_contract_sign_date")
        .gte("created_at", perfFyDateRange.start.toISOString())
        .lte("created_at", perfFyDateRange.end.toISOString());

      // Apply KAM filter
      if (filterKam) {
        dealsQuery = dealsQuery.eq("kam_id", filterKam);
      }

      // Apply Expected Contract Signing month filter
      if (filterExpectedContractSignMonth) {
        const month = parseInt(filterExpectedContractSignMonth);
        const year = getYearForMonthInFY(month, performanceDashboardFY);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        dealsQuery = dealsQuery
          .gte("expected_contract_sign_date", startDate.toISOString().split("T")[0])
          .lte("expected_contract_sign_date", endDate.toISOString().split("T")[0]);
      }

      // Fetch Funnel Counts for "Funnel Stage_Count of Sales Module" (Waterfall style - cumulative)
      // Get all status history records within the date range to track all deals that have been in each stage
      // First, get the deal IDs that match our filters
      const { data: filteredDeals, error: dealsError } = await dealsQuery as any;
      const filteredDealIds = filteredDeals ? filteredDeals.map((d: any) => d.id) : [];

      let allStatusHistoryQuery = supabase
        .from("deal_status_history" as any)
        .select("deal_id, old_status, new_status, changed_at")
        .gte("changed_at", perfFyDateRange.start.toISOString())
        .lte("changed_at", perfFyDateRange.end.toISOString());

      // Filter by deal IDs (which already includes the expected_contract_sign_date filter if month is selected)
      if (filteredDealIds.length > 0) {
        allStatusHistoryQuery = allStatusHistoryQuery.in("deal_id", filteredDealIds);
      } else {
        // If no deals match filters, return empty result
        allStatusHistoryQuery = allStatusHistoryQuery.eq("deal_id", "no-match");
      }

      const { data: allStatusHistory, error: historyError } = await allStatusHistoryQuery as any;

      // Also get current deals to handle deals that might not have history yet (newly created with "Listed" status)
      const currentDeals = filteredDeals;

      // If no deals match the filter, reset counts and return early
      if (filteredDealIds.length === 0) {
        setFunnelCounts({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
        setTotalDealsCount(0);
        // Continue to revenue section to reset that too
      }

      // Get total count of deals
      // If month filter is selected, count unique deals that were in any stage during that month
      // Otherwise, count deals created within the date range with filters
      let totalDeals = 0;
      let totalDealsError = null;

      if (filterExpectedContractSignMonth) {
        // When month filter is selected, count deals with expected_contract_sign_date in that month
        totalDeals = filteredDealIds.length;
      } else {
        // When no month filter, count deals created within the date range with filters
        let totalDealsQuery = supabase
          .from("pipeline_deals" as any)
          .select("*", { count: "exact", head: true })
          .gte("created_at", perfFyDateRange.start.toISOString())
          .lte("created_at", perfFyDateRange.end.toISOString());

        if (filterKam) {
          totalDealsQuery = totalDealsQuery.eq("kam_id", filterKam);
        }

        const { count, error } = await totalDealsQuery as any;
        totalDeals = count || 0;
        totalDealsError = error;
      }

      if (!dealsError && !historyError && (totalDealsError === null || !totalDealsError)) {
        // Set total deals count
        setTotalDealsCount(totalDeals || 0);
        // Define status groups
        const tofuStatuses = ["Listed", "Discovery Meeting Done", "Requirement Gathering Done"];
        const mofuStatuses = ["Solution Proposal Made", "SOW Handshake Done", "Final Proposal Done"];
        const bofuStatuses = ["Commercial Agreed"];

        // Track unique deals per funnel stage using Sets
        const tofuDeals = new Set<string>();
        const mofuDeals = new Set<string>();
        const bofuDeals = new Set<string>();
        const closedWonDeals = new Set<string>();
        const droppedDeals = new Set<string>();

        // Process all status history records
        if (allStatusHistory) {
          allStatusHistory.forEach((history: any) => {
            const dealId = history.deal_id;
            
            // Track deal in new_status (the status it moved to)
            if (history.new_status) {
              if (tofuStatuses.includes(history.new_status)) {
                tofuDeals.add(dealId);
              } else if (mofuStatuses.includes(history.new_status)) {
                mofuDeals.add(dealId);
              } else if (bofuStatuses.includes(history.new_status)) {
                bofuDeals.add(dealId);
              } else if (history.new_status === "Closed Won") {
                closedWonDeals.add(dealId);
              } else if (history.new_status === "Dropped") {
                droppedDeals.add(dealId);
              }
            }
            
            // Track deal in old_status (the status it moved from)
            if (history.old_status) {
              if (tofuStatuses.includes(history.old_status)) {
                tofuDeals.add(dealId);
              } else if (mofuStatuses.includes(history.old_status)) {
                mofuDeals.add(dealId);
              } else if (bofuStatuses.includes(history.old_status)) {
                bofuDeals.add(dealId);
              } else if (history.old_status === "Closed Won") {
                closedWonDeals.add(dealId);
              } else if (history.old_status === "Dropped") {
                droppedDeals.add(dealId);
              }
            }
          });
        }

        // Handle deals that are currently "Listed" but might not have history yet
        // Only include them if no month filter is selected (otherwise only count from status history)
        if (currentDeals && !filterExpectedContractSignMonth) {
          currentDeals.forEach((deal: any) => {
            const status = deal.status;
            // If deal is "Listed" and not in the Set yet, add it
            if (status === "Listed" && !tofuDeals.has(deal.id)) {
              tofuDeals.add(deal.id);
            }
          });
        }

        // Count unique deals per stage
        const tofu = tofuDeals.size;
        const mofu = mofuDeals.size;
        const bofu = bofuDeals.size;
        const closedWon = closedWonDeals.size;
        const dropped = droppedDeals.size;

        setFunnelCounts({ tofu, mofu, bofu, closedWon, dropped });
      } else {
        // If there's an error or no data, ensure counts are reset to zero
        setFunnelCounts({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
        setTotalDealsCount(0);
      }

      // Fetch Funnel Revenue for "Funnel Stage_Expected Revenue" (Waterfall style - cumulative)
      // Get all deals with revenue to map deal_id to expected_revenue
      let dealsRevenueQuery = supabase
        .from("pipeline_deals" as any)
        .select("id, expected_revenue, status, created_at, kam_id, expected_contract_sign_date")
        .gte("created_at", perfFyDateRange.start.toISOString())
        .lte("created_at", perfFyDateRange.end.toISOString());

      // Apply KAM filter
      if (filterKam) {
        dealsRevenueQuery = dealsRevenueQuery.eq("kam_id", filterKam);
      }

      // Apply Expected Contract Signing month filter
      if (filterExpectedContractSignMonth) {
        const month = parseInt(filterExpectedContractSignMonth);
        const year = getYearForMonthInFY(month, performanceDashboardFY);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        dealsRevenueQuery = dealsRevenueQuery
          .gte("expected_contract_sign_date", startDate.toISOString().split("T")[0])
          .lte("expected_contract_sign_date", endDate.toISOString().split("T")[0]);
      }

      const { data: allDealsWithRevenue, error: dealsRevenueError } = await dealsRevenueQuery as any;

      // If no deals match the filter, reset revenue
      if (!allDealsWithRevenue || allDealsWithRevenue.length === 0) {
        setFunnelRevenue({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
      }

      // Calculate current pipeline revenue (deals currently in TOFU, MOFU, or BOFU)
      if (!dealsRevenueError && allDealsWithRevenue) {
        const tofuStatuses = ["Listed", "Discovery Meeting Done", "Requirement Gathering Done"];
        const mofuStatuses = ["Solution Proposal Made", "SOW Handshake Done", "Final Proposal Done"];
        const bofuStatuses = ["Commercial Agreed"];

        const pipelineRevenue = allDealsWithRevenue.reduce((sum: number, deal: any) => {
          const status = deal.status;
          const expectedRevenue = parseFloat(deal.expected_revenue?.toString() || "0") || 0;
          
          // Check if deal is currently in TOFU, MOFU, or BOFU
          if (tofuStatuses.includes(status) || mofuStatuses.includes(status) || bofuStatuses.includes(status)) {
            return sum + expectedRevenue;
          }
          return sum;
        }, 0);

      }

      if (!dealsRevenueError && allDealsWithRevenue) {
        // Create a map of deal_id to expected_revenue
        const dealRevenueMap: Record<string, number> = {};
        allDealsWithRevenue.forEach((deal: any) => {
          const expectedRevenue = parseFloat(deal.expected_revenue?.toString() || "0") || 0;
          dealRevenueMap[deal.id] = expectedRevenue;
        });

        // Reuse the status history from above (or fetch again if needed)
        // We'll use the same Sets we created for counts, but sum revenue instead
        const tofuStatuses = ["Listed", "Discovery Meeting Done", "Requirement Gathering Done"];
        const mofuStatuses = ["Solution Proposal Made", "SOW Handshake Done", "Final Proposal Done"];
        const bofuStatuses = ["Commercial Agreed"];

        // Track unique deals per funnel stage using Sets (for revenue calculation)
        const tofuDealsForRevenue = new Set<string>();
        const mofuDealsForRevenue = new Set<string>();
        const bofuDealsForRevenue = new Set<string>();
        const closedWonDealsForRevenue = new Set<string>();
        const droppedDealsForRevenue = new Set<string>();

        // Process all status history records
        if (allStatusHistory) {
          allStatusHistory.forEach((history: any) => {
            const dealId = history.deal_id;
            
            // Track deal in new_status (the status it moved to)
            if (history.new_status) {
              if (tofuStatuses.includes(history.new_status)) {
                tofuDealsForRevenue.add(dealId);
              } else if (mofuStatuses.includes(history.new_status)) {
                mofuDealsForRevenue.add(dealId);
              } else if (bofuStatuses.includes(history.new_status)) {
                bofuDealsForRevenue.add(dealId);
              } else if (history.new_status === "Closed Won") {
                closedWonDealsForRevenue.add(dealId);
              } else if (history.new_status === "Dropped") {
                droppedDealsForRevenue.add(dealId);
              }
            }
            
            // Track deal in old_status (the status it moved from)
            if (history.old_status) {
              if (tofuStatuses.includes(history.old_status)) {
                tofuDealsForRevenue.add(dealId);
              } else if (mofuStatuses.includes(history.old_status)) {
                mofuDealsForRevenue.add(dealId);
              } else if (bofuStatuses.includes(history.old_status)) {
                bofuDealsForRevenue.add(dealId);
              } else if (history.old_status === "Closed Won") {
                closedWonDealsForRevenue.add(dealId);
              } else if (history.old_status === "Dropped") {
                droppedDealsForRevenue.add(dealId);
              }
            }
          });
        }

        // Handle deals that are currently "Listed" but might not have history yet
        if (currentDeals) {
          currentDeals.forEach((deal: any) => {
            const status = deal.status;
            // If deal is "Listed" and not in the Set yet, add it
            if (status === "Listed" && !tofuDealsForRevenue.has(deal.id)) {
              tofuDealsForRevenue.add(deal.id);
            }
          });
        }

        // Sum expected_revenue for all deals that have been in each stage
        const tofuRevenue = Array.from(tofuDealsForRevenue).reduce((sum, dealId) => {
          return sum + (dealRevenueMap[dealId] || 0);
        }, 0);

        const mofuRevenue = Array.from(mofuDealsForRevenue).reduce((sum, dealId) => {
          return sum + (dealRevenueMap[dealId] || 0);
        }, 0);

        const bofuRevenue = Array.from(bofuDealsForRevenue).reduce((sum, dealId) => {
          return sum + (dealRevenueMap[dealId] || 0);
        }, 0);

        const closedWonRevenue = Array.from(closedWonDealsForRevenue).reduce((sum, dealId) => {
          return sum + (dealRevenueMap[dealId] || 0);
        }, 0);

        const droppedRevenue = Array.from(droppedDealsForRevenue).reduce((sum, dealId) => {
          return sum + (dealRevenueMap[dealId] || 0);
        }, 0);

        setFunnelRevenue({ 
          tofu: tofuRevenue, 
          mofu: mofuRevenue,
          bofu: bofuRevenue, 
          closedWon: closedWonRevenue, 
          dropped: droppedRevenue 
        });
      } else {
        // If there's an error or no data, ensure revenue is reset to zero
        setFunnelRevenue({ tofu: 0, mofu: 0, bofu: 0, closedWon: 0, dropped: 0 });
      }

      // Fetch Cross Sell Target Sum for selected Financial Year
      // Convert performanceDashboardFY to financial_year format used in monthly_targets
      const perfFyYearMatch = performanceDashboardFY.match(/FY(\d{2})/);
      const perfFinancialYearString = perfFyYearMatch 
        ? (() => {
            const startYear = 2000 + parseInt(perfFyYearMatch[1], 10);
            const endYearDigits = String(parseInt(perfFyYearMatch[1], 10) + 1).padStart(2, '0');
            return `${startYear}-${endYearDigits}`;
          })()
        : null;

      // Get FY date range to determine which months to include
      const perfFyDateRangeForTarget = getFinancialYearDateRange(performanceDashboardFY);
      const perfFyStartYear = perfFyDateRangeForTarget.start.getFullYear();
      const perfFyEndYear = perfFyDateRangeForTarget.end.getFullYear();

      // All months in the financial year (April to March)
      const perfFyMonths = [
        { month: 4, year: perfFyStartYear },   // April
        { month: 5, year: perfFyStartYear },   // May
        { month: 6, year: perfFyStartYear },   // June
        { month: 7, year: perfFyStartYear },   // July
        { month: 8, year: perfFyStartYear },   // August
        { month: 9, year: perfFyStartYear },   // September
        { month: 10, year: perfFyStartYear },  // October
        { month: 11, year: perfFyStartYear },  // November
        { month: 12, year: perfFyStartYear },  // December
        { month: 1, year: perfFyEndYear },     // January
        { month: 2, year: perfFyEndYear },     // February
        { month: 3, year: perfFyEndYear },     // March
      ];

      // Fetch all cross sell type targets for the selected FY
      const perfFyMonthNumbers = perfFyMonths.map(m => m.month);
      const perfFyYears = [perfFyStartYear, perfFyEndYear];

      let crossSellTargetsQuery = supabase
        .from("monthly_targets")
        .select("target, month, year")
        .eq("target_type", "new_cross_sell")
        .in("month", perfFyMonthNumbers)
        .in("year", perfFyYears);

      // Filter by financial_year if available
      if (perfFinancialYearString) {
        crossSellTargetsQuery = crossSellTargetsQuery.eq("financial_year", perfFinancialYearString);
      }

      const { data: crossSellTargets, error: crossSellTargetsError } = await crossSellTargetsQuery;

      let totalCrossSellTarget = 0;
      if (!crossSellTargetsError && crossSellTargets) {
        // Filter to only include targets that match the FY months exactly
        crossSellTargets.forEach((target: any) => {
          const matchesFyMonth = perfFyMonths.some(
            (fyMonth) => fyMonth.month === target.month && fyMonth.year === target.year
          );
          if (matchesFyMonth) {
            totalCrossSellTarget += parseFloat(target.target?.toString() || "0") || 0;
          }
        });
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching funnel data:", error);
      setLoading(false);
    }
  };

  const fetchKams = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam")
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

  useEffect(() => {
    fetchKams();
  }, []);

  useEffect(() => {
    fetchFunnelData();
    fetchConversionTableData();
    fetchMeetingsAndProposalsData();
  }, [performanceDashboardFY, filterKam, filterExpectedContractSignMonth]);

  // Render Count Chart with D3
  useEffect(() => {
    if (!countChartRef.current || loading) return;
    
    // Clear previous chart and tooltip
    d3.select(countChartRef.current).selectAll("*").remove();
    d3.select("body").selectAll(".tooltip").remove();
    
    // Prepare data
    const categories = [
      { name: "TOFU", value: funnelCounts.tofu, fill: "#3b82f6" },
      { name: "MOFU", value: funnelCounts.mofu, fill: "#f97316" },
      { name: "BOFU", value: funnelCounts.bofu, fill: "#eab308" },
      { name: "Closed Won", value: funnelCounts.closedWon, fill: "#22c55e" },
      { name: "Dropped", value: funnelCounts.dropped, fill: "#d1d5db" },
    ];

    // Sort by value ASCENDING (smallest first)
    const sorted = [...categories].sort((a, b) => a.value - b.value);

    // Group consecutive equal values
    const groups: Array<Array<typeof categories[0]>> = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].value - sorted[i - 1].value) < 0.0001) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }
    groups.push(currentGroup);

    // Calculate positions for stacking
    // Each bar's height is the difference between its value and the previous bar's value
    let previousValue = 0; // Track the previous bar's value
    const segments: Array<{
      items: typeof categories;
      value: number;
      startY: number;
      endY: number;
      isEqual: boolean;
    }> = [];

    groups.forEach((group) => {
      const value = group[0].value;
      const barHeight = value - previousValue; // Height = difference from previous value
      const startY = previousValue; // Start at previous bar's value
      const endY = value; // End at current bar's value
      segments.push({
        items: group,
        value,
        startY: startY,
        endY: endY,
        isEqual: group.length > 1,
      });
      previousValue = value; // Next bar uses this value as previous
    });

    // Set up SVG
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = countChartRef.current.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(countChartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(["Total"])
      .range([0, width])
      .padding(0.3);

    // Y scale domain goes from 0 to the maximum value
    const maxValue = Math.max(...categories.map(c => c.value), 1);
    const yScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([height, 0]);

    // Draw grid lines
    const yTicks = yScale.ticks(5);
    g.selectAll(".grid-line")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "3,3");

    // Create tooltip div
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "hsl(var(--popover))")
      .style("border", "1px solid hsl(var(--border))")
      .style("border-radius", "6px")
      .style("padding", "8px 12px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)");

    // Draw bars
    segments.forEach((segment) => {
      const barStartY = yScale(segment.endY); // Bottom of bar (higher Y value in SVG)
      const barEndY = yScale(segment.startY); // Top of bar (lower Y value in SVG)
      const barHeight = barEndY - barStartY;

      if (segment.isEqual) {
        // Equal values - draw side-by-side, all starting and ending at same Y
        const barWidth = xScale.bandwidth() * 0.4;
        const individualWidth = barWidth / segment.items.length;
        const startX = xScale("Total")! + (xScale.bandwidth() - barWidth) / 2;

        segment.items.forEach((item, idx) => {
          const x = startX + idx * individualWidth;
          
          const rect = g.append("rect")
            .attr("x", x)
            .attr("y", barStartY)
            .attr("width", individualWidth)
            .attr("height", barHeight)
            .attr("fill", item.fill)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("mouseover", function(event) {
              d3.select(this)
                .attr("opacity", 0.8)
                .attr("stroke-width", 2);
              
              const [mouseX, mouseY] = d3.pointer(event, svg.node());
              tooltip
                .style("opacity", 1)
                .html(`<div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div><div style="color: hsl(var(--muted-foreground));">${item.value.toLocaleString("en-IN")}</div>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mousemove", function(event) {
              tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
              d3.select(this)
                .attr("opacity", 1)
                .attr("stroke-width", 1);
              
              tooltip.style("opacity", 0);
            });
        });
      } else {
        // Single bar
        const barWidth = xScale.bandwidth() * 0.4;
        const x = xScale("Total")! + (xScale.bandwidth() - barWidth) / 2;
        
        const rect = g.append("rect")
          .attr("x", x)
          .attr("y", barStartY)
          .attr("width", barWidth)
          .attr("height", barHeight)
          .attr("fill", segment.items[0].fill)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("mouseover", function(event) {
            d3.select(this)
              .attr("opacity", 0.8)
              .attr("stroke-width", 2);
            
            const [mouseX, mouseY] = d3.pointer(event, svg.node());
            tooltip
              .style("opacity", 1)
              .html(`<div style="font-weight: 600; margin-bottom: 4px;">${segment.items[0].name}</div><div style="color: hsl(var(--muted-foreground));">${segment.items[0].value.toLocaleString("en-IN")}</div>`)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("opacity", 1)
              .attr("stroke-width", 1);
            
            tooltip.style("opacity", 0);
          });
      }
    });

    // Y Axis
    const yAxis = d3.axisLeft(yScale);
    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis);

    // Legend
    const legend = g.append("g")
      .attr("transform", `translate(${width - 100}, 10)`);

    categories.forEach((cat, idx) => {
      const legendItem = legend.append("g")
        .attr("transform", `translate(0, ${idx * 20})`);
      
      legendItem.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", cat.fill);
      
      legendItem.append("text")
        .attr("x", 16)
        .attr("y", 9)
        .attr("font-size", "11px")
        .text(cat.name);
    });
  }, [funnelCounts, loading]);

  // Render Revenue Chart with D3
  useEffect(() => {
    if (!revenueChartRef.current || loading) return;
    
    // Clear previous chart
    d3.select(revenueChartRef.current).selectAll("*").remove();
    
    // Prepare data
    const categories = [
      { name: "TOFU", value: funnelRevenue.tofu / 100000, fill: "#3b82f6" },
      { name: "MOFU", value: funnelRevenue.mofu / 100000, fill: "#f97316" },
      { name: "BOFU", value: funnelRevenue.bofu / 100000, fill: "#eab308" },
      { name: "Closed Won", value: funnelRevenue.closedWon / 100000, fill: "#22c55e" },
      { name: "Dropped", value: funnelRevenue.dropped / 100000, fill: "#d1d5db" },
    ];

    // Sort by value ASCENDING (smallest first)
    const sorted = [...categories].sort((a, b) => a.value - b.value);

    // Group consecutive equal values
    const groups: Array<Array<typeof categories[0]>> = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].value - sorted[i - 1].value) < 0.0001) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }
    groups.push(currentGroup);

    // Calculate positions for stacking
    // Each bar's height is the difference between its value and the previous bar's value
    let previousValue = 0; // Track the previous bar's value
    const segments: Array<{
      items: typeof categories;
      value: number;
      startY: number;
      endY: number;
      isEqual: boolean;
    }> = [];

    groups.forEach((group) => {
      const value = group[0].value;
      const barHeight = value - previousValue; // Height = difference from previous value
      const startY = previousValue; // Start at previous bar's value
      const endY = value; // End at current bar's value
      segments.push({
        items: group,
        value,
        startY: startY,
        endY: endY,
        isEqual: group.length > 1,
      });
      previousValue = value; // Next bar uses this value as previous
    });

    // Set up SVG
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = revenueChartRef.current.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(revenueChartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(["Total"])
      .range([0, width])
      .padding(0.3);

    // Y scale domain goes from 0 to the maximum value
    const maxValue = Math.max(...categories.map(c => c.value), 1);
    const yScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([height, 0]);

    // Draw grid lines
    const yTicks = yScale.ticks(5);
    g.selectAll(".grid-line")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "3,3");

    // Create tooltip div
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "hsl(var(--popover))")
      .style("border", "1px solid hsl(var(--border))")
      .style("border-radius", "6px")
      .style("padding", "8px 12px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)");

    // Draw bars
    segments.forEach((segment) => {
      const barStartY = yScale(segment.endY); // Bottom of bar (higher Y value in SVG)
      const barEndY = yScale(segment.startY); // Top of bar (lower Y value in SVG)
      const barHeight = barEndY - barStartY;

      if (segment.isEqual) {
        // Equal values - draw side-by-side, all starting and ending at same Y
        const barWidth = xScale.bandwidth() * 0.4;
        const individualWidth = barWidth / segment.items.length;
        const startX = xScale("Total")! + (xScale.bandwidth() - barWidth) / 2;

        segment.items.forEach((item, idx) => {
          const x = startX + idx * individualWidth;
          
          const rect = g.append("rect")
            .attr("x", x)
            .attr("y", barStartY)
            .attr("width", individualWidth)
            .attr("height", barHeight)
            .attr("fill", item.fill)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("mouseover", function(event) {
              d3.select(this)
                .attr("opacity", 0.8)
                .attr("stroke-width", 2);
              
              const [mouseX, mouseY] = d3.pointer(event, svg.node());
              tooltip
                .style("opacity", 1)
                .html(`<div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div><div style="color: hsl(var(--muted-foreground));">₹${item.value.toFixed(1)}L</div>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mousemove", function(event) {
              tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
              d3.select(this)
                .attr("opacity", 1)
                .attr("stroke-width", 1);
              
              tooltip.style("opacity", 0);
            });
        });
      } else {
        // Single bar
        const barWidth = xScale.bandwidth() * 0.4;
        const x = xScale("Total")! + (xScale.bandwidth() - barWidth) / 2;
        
        const rect = g.append("rect")
          .attr("x", x)
          .attr("y", barStartY)
          .attr("width", barWidth)
          .attr("height", barHeight)
          .attr("fill", segment.items[0].fill)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("mouseover", function(event) {
            d3.select(this)
              .attr("opacity", 0.8)
              .attr("stroke-width", 2);
            
            const [mouseX, mouseY] = d3.pointer(event, svg.node());
            tooltip
              .style("opacity", 1)
              .html(`<div style="font-weight: 600; margin-bottom: 4px;">${segment.items[0].name}</div><div style="color: hsl(var(--muted-foreground));">₹${segment.items[0].value.toFixed(1)}L</div>`)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("opacity", 1)
              .attr("stroke-width", 1);
            
            tooltip.style("opacity", 0);
          });
      }
    });

    // Y Axis
    const yAxis = d3.axisLeft(yScale);
    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis);

    // Legend
    const legend = g.append("g")
      .attr("transform", `translate(${width - 100}, 10)`);

    categories.forEach((cat, idx) => {
      const legendItem = legend.append("g")
        .attr("transform", `translate(0, ${idx * 20})`);
      
      legendItem.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", cat.fill);
      
      legendItem.append("text")
        .attr("x", 16)
        .attr("y", 9)
        .attr("font-size", "11px")
        .text(cat.name);
    });
  }, [funnelRevenue, loading]);

  // Generate month options (just month names)
  const monthOptions = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cross Sell Dashboard</h1>
        <p className="text-muted-foreground">
          View and analyze cross-sell opportunities and performance metrics.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Financial Year Filter */}
        <Select value={performanceDashboardFY} onValueChange={setPerformanceDashboardFY}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Select FY" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FY24">FY24</SelectItem>
            <SelectItem value="FY25">FY25</SelectItem>
            <SelectItem value="FY26">FY26</SelectItem>
            <SelectItem value="FY27">FY27</SelectItem>
            <SelectItem value="FY28">FY28</SelectItem>
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

        {/* Expected Contract Signing Month Filter */}
        <Select value={filterExpectedContractSignMonth || "all"} onValueChange={(value) => setFilterExpectedContractSignMonth(value === "all" ? "" : value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Months">
              {filterExpectedContractSignMonth && filterExpectedContractSignMonth !== "all" 
                ? monthOptions.find(m => m.value === filterExpectedContractSignMonth)?.label || ""
                : "All Months"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Funnel Stage and Activity Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {/* Funnel Stage_Count of Sales Module */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Funnel Stage Count of Sales Module</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Total Box */}
            <div className="mb-4 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-lg border bg-muted px-4 py-2">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-lg font-bold">
                  {totalDealsCount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <div className="flex gap-4">
              {(() => {
                const values = { 
                  tofu: funnelCounts.tofu,
                  mofu: funnelCounts.mofu,
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
                        const gapBetweenBars = 60;
                        const gapBetweenDuplicates = 8;
                        const squareSize = calculateWidth(values.dropped);
                        
                        // Calculate Y positions for each bar (8 lines for 4 segments)
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
                        const y7Top = y6Bottom + gapBetweenDuplicates;
                        const y7Bottom = y7Top + barHeight;
                        const y8Top = y7Bottom + gapBetweenBars;
                        const y8Bottom = y8Top + barHeight;
                        const squareY = y8Bottom + 8;
                        const totalHeight = squareY + squareSize;
                        
                        return (
                          <svg className="absolute top-0 left-0" style={{ width: `${maxWidth}px`, height: `${totalHeight}px`, pointerEvents: 'none' }}>
                            {/* Blue funnel segment: Line 1 to Line 2 (TOFU -> MOFU) */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.tofu) / 2},${y1Top}
                                ${maxWidth / 2 + calculateWidth(values.tofu) / 2},${y1Top}
                                ${maxWidth / 2 + calculateWidth(values.mofu) / 2},${y2Bottom}
                                ${maxWidth / 2 - calculateWidth(values.mofu) / 2},${y2Bottom}
                              `}
                              fill="#3b82f6"
                            />
                            
                            {/* Orange funnel segment: Line 3 to Line 4 (MOFU -> BOFU) */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.mofu) / 2},${y3Top}
                                ${maxWidth / 2 + calculateWidth(values.mofu) / 2},${y3Top}
                                ${maxWidth / 2 + calculateWidth(values.bofu) / 2},${y4Bottom}
                                ${maxWidth / 2 - calculateWidth(values.bofu) / 2},${y4Bottom}
                              `}
                              fill="#f97316"
                            />
                            
                            {/* Yellow funnel segment: Line 5 to Line 6 (BOFU -> Closed Won) */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.bofu) / 2},${y5Top}
                                ${maxWidth / 2 + calculateWidth(values.bofu) / 2},${y5Top}
                                ${maxWidth / 2 + calculateWidth(values.closedWon) / 2},${y6Bottom}
                                ${maxWidth / 2 - calculateWidth(values.closedWon) / 2},${y6Bottom}
                              `}
                              fill="#eab308"
                            />
                            
                            {/* Green funnel segment: Line 7 to Line 8 (Closed Won -> Dropped) */}
                            <polygon
                              points={`
                                ${maxWidth / 2 - calculateWidth(values.closedWon) / 2},${y7Top}
                                ${maxWidth / 2 + calculateWidth(values.closedWon) / 2},${y7Top}
                                ${maxWidth / 2 + calculateWidth(values.dropped) / 2},${y8Bottom}
                                ${maxWidth / 2 - calculateWidth(values.dropped) / 2},${y8Bottom}
                              `}
                              fill="#22c55e"
                            />
                            
                            {/* Line 1: TOFU */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.tofu) / 2}
                              y={y1Top}
                              width={calculateWidth(values.tofu)}
                              height={barHeight}
                              fill="#3b82f6"
                            />
                            
                            {/* Line 2: MOFU's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.mofu) / 2}
                              y={y2Top}
                              width={calculateWidth(values.mofu)}
                              height={barHeight}
                              fill="#3b82f6"
                            />
                            
                            {/* Line 3: MOFU's 2nd */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.mofu) / 2}
                              y={y3Top}
                              width={calculateWidth(values.mofu)}
                              height={barHeight}
                              fill="#f97316"
                            />
                            
                            {/* Line 4: BOFU's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.bofu) / 2}
                              y={y4Top}
                              width={calculateWidth(values.bofu)}
                              height={barHeight}
                              fill="#f97316"
                            />
                            
                            {/* Line 5: BOFU's 2nd */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.bofu) / 2}
                              y={y5Top}
                              width={calculateWidth(values.bofu)}
                              height={barHeight}
                              fill="#eab308"
                            />
                            
                            {/* Line 6: Closed Won's 1st */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.closedWon) / 2}
                              y={y6Top}
                              width={calculateWidth(values.closedWon)}
                              height={barHeight}
                              fill="#eab308"
                            />
                            
                            {/* Line 7: Closed Won's 2nd */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.closedWon) / 2}
                              y={y7Top}
                              width={calculateWidth(values.closedWon)}
                              height={barHeight}
                              fill="#22c55e"
                            />
                            
                            {/* Line 8: Dropped */}
                            <rect
                              x={maxWidth / 2 - calculateWidth(values.dropped) / 2}
                              y={y8Top}
                              width={calculateWidth(values.dropped)}
                              height={barHeight}
                              fill="#d1d5db"
                            />
                            
                            {/* Square at the bottom with side length equal to dropped value */}
                            <rect
                              x={maxWidth / 2 - squareSize / 2}
                              y={squareY}
                              width={squareSize}
                              height={squareSize}
                              fill="#d1d5db"
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
                      const y7Top = y6Bottom + gapBetweenDuplicates;
                      const y7Bottom = y7Top + barHeight;
                      const y8Top = y7Bottom + gapBetweenBars;
                      const y8Bottom = y8Top + barHeight;
                      const squareY = y8Bottom + 8;
                      
                      // Calculate vertical centers of each colored shape
                      const tofuCenter = (y1Top + y2Bottom) / 2;
                      const mofuCenter = (y3Top + y4Bottom) / 2;
                      const bofuCenter = (y5Top + y6Bottom) / 2;
                      const closedWonCenter = (y7Top + y8Bottom) / 2;
                      const droppedCenter = squareY + squareSize / 2;
                      
                      return (
                        <div className="flex flex-col relative ml-auto" style={{ height: `${squareY + squareSize}px` }}>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${tofuCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            TOFU : <span className="font-bold">{values.tofu}</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${mofuCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            MOFU : <span className="font-bold">{values.mofu}</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${bofuCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            BOFU : <span className="font-bold">{values.bofu}</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${closedWonCenter}px`, transform: 'translateY(-50%)' }}
                          >
                            Closed Won : <span className="font-bold">{values.closedWon}</span>
                          </span>
                          <span 
                            className="font-medium text-gray-800 whitespace-nowrap absolute right-0"
                            style={{ top: `${droppedCenter}px`, transform: 'translateY(-50%)' }}
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


        {/* Meetings and Proposals Metrics */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">{meetingsDoneLastWeek}</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Meetings Done Last Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">{meetingsDoneThisWeek}</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Meetings Done This Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">{proposalMadeLastWeek}</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Proposal Made Last Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-center">{proposalMadeThisWeek}</div>
              <p className="text-sm text-muted-foreground text-center mt-1">Proposal Made This Week</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bar Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stage Count Graph */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage Count Graph</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div ref={countChartRef} style={{ height: '300px', width: '100%' }} />
            )}
          </CardContent>
        </Card>

        {/* Stage Revenue Graph */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage Revenue Graph</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div ref={revenueChartRef} style={{ height: '300px', width: '100%' }} />
            )}
          </CardContent>
        </Card>
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
                <TableHead className="w-[200px]">MCV</TableHead>
                <TableHead className="w-[200px]">Cumulative # of Records</TableHead>
                <TableHead>CVR to next status</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Dropped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : conversionTableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No data available for {performanceDashboardFY}
                  </TableCell>
                </TableRow>
              ) : (
                conversionTableData.map((row, idx) => {
                  const maxRecords = row.maxRecords || row.records || 1;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.status}</TableCell>
                      <TableCell className="w-[200px]">
                        ₹{row.mcv.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="w-12">{row.records}</span>
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
