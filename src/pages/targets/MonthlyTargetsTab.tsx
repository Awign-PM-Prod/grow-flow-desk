import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV, downloadCSV } from "@/lib/csv-export";
import { formatNumber } from "@/lib/utils";
import { CSVPreviewDialog } from "@/components/CSVPreviewDialog";
import {
  calculateFinancialYear,
  formatFYLabel,
  fyKeyToFinancialYearString,
  getFinancialYearMonths,
} from "./financialYearUtils";
import type { TargetsOutletContext } from "./TargetsLayout";

interface MonthlyTargetFormData {
  month: string;
  year: string;
  target: string;
  financialYear: string;
  targetType: string;
  kamId: string;
  accountId: string;
  mandateId: string;
}

interface MonthlyTarget {
  id: string;
  month: number;
  year: number;
  financial_year: string;
  target: number;
  created_by: string;
  created_at: string;
  target_type?: string | null;
  account_id?: string | null;
  mandate_id?: string | null;
  kam_id?: string | null;
  accountName?: string | null;
  kamName?: string | null;
  mandateInfo?: { project_code: string; project_name: string } | null;
}

interface Account {
  id: string;
  name: string;
}

interface Mandate {
  id: string;
  project_code: string;
  project_name: string;
}

interface KAM {
  id: string;
  full_name: string;
}

export function MonthlyTargetsTab({
  mode,
}: {
  mode: "existing" | "new_cross_sell";
}) {
  const { filterFinancialYear, selectedTeam } = useOutletContext<TargetsOutletContext>();
  const { hasRole, loading, userRoles, user, fullName, canMutatePortal, canSelectAllTeams, team: userTeam } = useAuth();
  const isKAM = hasRole("kam");
  /** KAM role without manager/superadmin — scoped to own targets only. */
  const isKamOnly =
    hasRole("kam") && !hasRole("manager") && !hasRole("superadmin");
  const { toast } = useToast();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MonthlyTarget | null>(null);
  const [formData, setFormData] = useState<MonthlyTargetFormData>({
    month: "",
    year: "",
    target: "",
    financialYear: "",
    targetType: "",
    kamId: "",
    accountId: "",
    mandateId: "",
  });
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Data structures for the new table view
  const [existingTargetsData, setExistingTargetsData] = useState<Record<string, Record<string, number>>>({}); // mandateId -> monthKey -> target
  const [crossSellTargetsData, setCrossSellTargetsData] = useState<Record<string, Record<string, number>>>({}); // kamId_accountId -> monthKey -> target
  const [crossSellKamAccountCombos, setCrossSellKamAccountCombos] = useState<Array<{ kamId: string; kamName: string; accountId: string; accountName: string }>>([]); // List of unique KAM-account combinations
  const [allMandates, setAllMandates] = useState<Array<{
    id: string;
    project_code: string;
    project_name: string;
    kam_id?: string | null;
    kamName?: string | null;
    type?: string | null;
    new_sales_owner?: string | null;
    nsoInfo?: { first_name: string; last_name: string } | null;
  }>>([]);
  const [allAccounts, setAllAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [monthColumns, setMonthColumns] = useState<
    Array<{ month: number; year: number; key: string; label: string }>
  >([]);
  const [kams, setKams] = useState<KAM[]>([]);
  const [loadingKams, setLoadingKams] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loadingMandates, setLoadingMandates] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [mandateSearch, setMandateSearch] = useState("");
  
  // Bulk upload state
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [selectedTargetType, setSelectedTargetType] = useState<"cross_sell" | "existing" | null>(null);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<{ rowNumber: number; data: Record<string, any>; isValid: boolean; errors: string[] }>>([]);
  const [csvFileToUpload, setCsvFileToUpload] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const effectiveTeam =
    canSelectAllTeams && selectedTeam !== "all" ? selectedTeam : userTeam;

  const applyMandateTeamFilter = (query: any) => {
    if (canSelectAllTeams && selectedTeam === "all") return query;
    if (!effectiveTeam) return query;
    return query.eq("team", effectiveTeam);
  };

  const fetchMonthlyTargets = async () => {
    setLoadingTargets(true);
    try {
      // Get current user and KAM status (in case they changed)
      const currentUser = user;
      const currentIsKAM = hasRole("kam");
      
      // Calculate month columns for selected FY
      const calculatedMonthColumns = getFinancialYearMonths(filterFinancialYear);
      setMonthColumns(calculatedMonthColumns);
      
      // Convert FY filter to financial_year format used in monthly_targets (e.g., "FY25" -> "2025-26")
      const financialYearString = fyKeyToFinancialYearString(filterFinancialYear);
      
      // Fetch targets filtered by selected FY
      let query = supabase
        .from("monthly_targets")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      
      // Filter by financial_year if available
      if (financialYearString) {
        query = query.eq("financial_year", financialYearString);
      }
      query = query.eq("target_type", mode);

      const { data, error } = await query;

      if (error) {
        // If table doesn't exist, show empty array instead of error
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          console.warn("Monthly targets table does not exist yet.");
          setMonthlyTargets([]);
          setExistingTargetsData({});
          setCrossSellTargetsData({});
          setLoadingTargets(false);
          return;
        }
        throw error;
      }

      // Fetch all mandates for existing targets table
      // If user is a KAM, filter by their KAM ID
      let mandatesQuery = applyMandateTeamFilter(supabase
        .from("mandates")
        .select("id, project_code, project_name, kam_id, account_id, type, new_sales_owner, lifecycle_status"));
      
      if (currentIsKAM && currentUser?.id) {
        mandatesQuery = mandatesQuery.eq("kam_id", currentUser.id);
      }
      
      const { data: allMandatesData } = await mandatesQuery.order("project_code");
      
      // Fetch KAM names for mandates
      const mandateKamIds = [...new Set((allMandatesData || []).map((m: any) => m.kam_id).filter(Boolean))];
      const mandateKamMap: Record<string, string> = {};
      
      if (mandateKamIds.length > 0) {
        const { data: mandateKamData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", mandateKamIds);
        
        if (mandateKamData) {
          mandateKamData.forEach((kam) => {
            mandateKamMap[kam.id] = kam.full_name || "Unknown";
          });
        }
      }
      
      // Fetch NSO data for mandates with type "New Acquisition"
      const nsoMailIds = [...new Set((allMandatesData || [])
        .filter((m: any) => m.type === "New Acquisition" && m.new_sales_owner)
        .map((m: any) => m.new_sales_owner)
        .filter(Boolean))];
      
      const nsoMap: Record<string, { first_name: string; last_name: string }> = {};
      
      if (nsoMailIds.length > 0) {
        const { data: nsoData } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("role", "nso")
          .in("email", nsoMailIds);

        if (nsoData) {
          nsoData.forEach((row) => {
            const name = row.full_name?.trim() || "";
            const parts = name.split(/\s+/).filter(Boolean);
            nsoMap[row.email] = {
              first_name: parts[0] || row.email,
              last_name: parts.slice(1).join(" "),
            };
          });
        }
      }
      
      // Add KAM names and NSO info to mandates
      const mandatesWithKam = (allMandatesData || []).map((mandate: any) => ({
        ...mandate,
        kamName: mandate.kam_id ? mandateKamMap[mandate.kam_id] || "Unknown" : null,
        nsoInfo: mandate.type === "New Acquisition" && mandate.new_sales_owner && nsoMap[mandate.new_sales_owner]
          ? nsoMap[mandate.new_sales_owner]
          : null,
      }));
      
      setAllMandates(mandatesWithKam);

      // Fetch all accounts for cross sell targets table
      // If user is a KAM, only fetch accounts linked to their mandates
      let allAccountsData: any[] = [];
      
      if (currentIsKAM && currentUser?.id) {
        // Get account IDs from KAM's mandates
        const { data: kamMandatesData } = await applyMandateTeamFilter(supabase
          .from("mandates")
          .select("account_id")
          .eq("kam_id", currentUser.id)
          .not("account_id", "is", null));
        
        const accountIds = [...new Set((kamMandatesData || []).map((m: any) => m.account_id).filter(Boolean))];
        
        if (accountIds.length > 0) {
          const { data: accountsData } = await supabase
            .from("accounts")
            .select("id, name")
            .in("id", accountIds)
            .order("name");
          allAccountsData = accountsData || [];
        }
      } else {
        const { data: accountsData } = await supabase
          .from("accounts")
          .select("id, name")
          .order("name");
        allAccountsData = accountsData || [];
      }
      
      setAllAccounts(allAccountsData);

      // Fetch account, mandate, and KAM names for display (for form editing)
      const accountIds = [...new Set((data || []).map((t: any) => t.account_id).filter(Boolean))];
      const mandateIds = [...new Set((data || []).map((t: any) => t.mandate_id).filter(Boolean))];
      const kamIds = [...new Set((data || []).map((t: any) => t.kam_id).filter(Boolean))];

      const accountMap: Record<string, string> = {};
      const mandateMap: Record<string, { project_code: string; project_name: string }> = {};
      const kamMap: Record<string, string> = {};

      if (accountIds.length > 0) {
        const { data: accountData } = await supabase
          .from("accounts")
          .select("id, name")
          .in("id", accountIds);

        if (accountData) {
          accountData.forEach((acc) => {
            accountMap[acc.id] = acc.name || "Unknown";
          });
        }
      }

      if (mandateIds.length > 0) {
        const { data: mandateData } = await applyMandateTeamFilter(supabase
          .from("mandates")
          .select("id, project_code, project_name")
          .in("id", mandateIds));

        if (mandateData) {
          mandateData.forEach((mandate) => {
            mandateMap[mandate.id] = {
              project_code: mandate.project_code || "Unknown",
              project_name: mandate.project_name || "Unknown",
            };
          });
        }
      }

      if (kamIds.length > 0) {
        const { data: kamData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", kamIds);

        if (kamData) {
          kamData.forEach((kam) => {
            kamMap[kam.id] = kam.full_name || "Unknown";
          });
        }
      }

      // Include KAM names from mandates for pipeline grid rows
      (allMandatesData || []).forEach((mandate: any) => {
        if (mandate.kam_id && mandateKamMap[mandate.kam_id]) {
          kamMap[mandate.kam_id] = mandateKamMap[mandate.kam_id];
        }
      });
      allAccountsData.forEach((account: any) => {
        accountMap[account.id] = account.name || "Unknown";
      });

      // Add account, mandate, and KAM names to targets (for form editing)
      const targetsWithNames = (data || []).map((target: any) => ({
        ...target,
        accountName: target.account_id ? accountMap[target.account_id] : null,
        kamName: target.kam_id ? kamMap[target.kam_id] : null,
        mandateInfo: target.mandate_id ? mandateMap[target.mandate_id] : null,
      }));

      setMonthlyTargets(targetsWithNames);

      // Organize targets by type for table display
      // Filter targets by KAM's mandates and accounts if user is a KAM
      const existingData: Record<string, Record<string, number>> = {};
      const crossSellData: Record<string, Record<string, number>> = {}; // kamId_accountId -> monthKey -> target
      const kamAccountComboSet = new Set<string>(); // Track unique KAM-account combinations
      const teamMandateIds = new Set(
        (allMandatesData || []).map((m: any) => m.id).filter(Boolean)
      );
      const teamKamAccountRelations = new Set(
        (allMandatesData || [])
          .filter((m: any) => m.kam_id && m.account_id)
          .map((m: any) => `${m.kam_id}_${m.account_id}`)
      );

      // Get KAM's mandate IDs and account IDs for filtering
      const kamMandateIds = currentIsKAM && currentUser?.id ? new Set((allMandatesData || []).map((m: any) => m.id)) : null;

      const teamScopedView =
        Boolean(effectiveTeam) && !(canSelectAllTeams && selectedTeam === "all");

      // Scope table rows: KAM sees own pipeline targets; team filter applies to managers/admins
      let filteredTargets = (data || []).filter((target: any) => {
        if (target.target_type === "existing" && target.mandate_id) {
          if (currentIsKAM && currentUser?.id) {
            return kamMandateIds?.has(target.mandate_id) || false;
          }
          return teamMandateIds.has(target.mandate_id);
        }
        if (target.target_type === "new_cross_sell" && target.kam_id && target.account_id) {
          if (currentIsKAM && currentUser?.id) {
            return target.kam_id === currentUser.id;
          }
          if (teamScopedView) {
            return teamKamAccountRelations.has(
              `${target.kam_id}_${target.account_id}`
            );
          }
          return true;
        }
        return false;
      });

      // Seed pipeline rows from mandate KAM–account links (not only existing targets)
      if (mode === "new_cross_sell") {
        (allMandatesData || []).forEach((mandate: any) => {
          if (!mandate.kam_id || !mandate.account_id) return;
          if (currentIsKAM && currentUser?.id && mandate.kam_id !== currentUser.id) {
            return;
          }
          kamAccountComboSet.add(`${mandate.kam_id}_${mandate.account_id}`);
        });
      }

      filteredTargets.forEach((target: any) => {
        const monthKey = `${target.year}-${String(target.month).padStart(2, '0')}`;

        if (target.target_type === "existing" && target.mandate_id) {
          if (!existingData[target.mandate_id]) {
            existingData[target.mandate_id] = {};
          }
          existingData[target.mandate_id][monthKey] = parseFloat(target.target?.toString() || "0") || 0;
        } else if (target.target_type === "new_cross_sell" && target.account_id && target.kam_id) {
          // Use composite key: kamId_accountId
          const compositeKey = `${target.kam_id}_${target.account_id}`;
          if (!crossSellData[compositeKey]) {
            crossSellData[compositeKey] = {};
          }
          crossSellData[compositeKey][monthKey] = parseFloat(target.target?.toString() || "0") || 0;
          
          // Track unique KAM-account combinations
          kamAccountComboSet.add(compositeKey);
        }
      });

      // Build list of unique KAM-account combinations with names
      const kamAccountCombos: Array<{ kamId: string; kamName: string; accountId: string; accountName: string }> = [];
      kamAccountComboSet.forEach((compositeKey) => {
        const sep = compositeKey.indexOf("_");
        if (sep === -1) return;
        const kamId = compositeKey.slice(0, sep);
        const accountId = compositeKey.slice(sep + 1);
        kamAccountCombos.push({
          kamId,
          kamName: kamMap[kamId] || mandateKamMap[kamId] || "Unknown KAM",
          accountId,
          accountName: accountMap[accountId] || "Unknown Account",
        });
      });

      // Sort by KAM name, then by account name
      kamAccountCombos.sort((a, b) => {
        const kamCompare = a.kamName.localeCompare(b.kamName);
        if (kamCompare !== 0) return kamCompare;
        return a.accountName.localeCompare(b.accountName);
      });

      setExistingTargetsData(existingData);
      setCrossSellTargetsData(crossSellData);
      setCrossSellKamAccountCombos(kamAccountCombos);
    } catch (error: any) {
      console.error("Error fetching monthly targets:", error);
      // Only show error toast if it's not a "table doesn't exist" error
      if (!error.message?.includes("does not exist") && !error.code?.includes("42P01")) {
        toast({
          title: "Error",
          description: "Failed to load monthly targets. Please try again.",
          variant: "destructive",
        });
      }
      setMonthlyTargets([]);
      setExistingTargetsData({});
      setCrossSellTargetsData({});
      setCrossSellKamAccountCombos([]);
    } finally {
      setLoadingTargets(false);
    }
  };

  const fetchKams = async () => {
    setLoadingKams(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam")
        .order("full_name");

      if (error) {
        console.error("Error fetching KAMs:", error);
        setKams([]);
      } else {
        setKams(data || []);
      }
    } catch (error: any) {
      console.error("Error fetching KAMs:", error);
      setKams([]);
    } finally {
      setLoadingKams(false);
    }
  };

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("Error fetching accounts:", error);
        setAccounts([]);
      } else {
        setAccounts(data || []);
      }
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Fetch accounts linked to selected KAM through mandates
  const fetchAccountsByKam = async (kamId: string) => {
    if (!kamId) {
      setFilteredAccounts([]);
      return;
    }

    setLoadingAccounts(true);
    try {
      // Get all mandates for this KAM
      const { data: mandatesData, error: mandatesError } = await applyMandateTeamFilter(supabase
        .from("mandates")
        .select("account_id")
        .eq("kam_id", kamId)
        .not("account_id", "is", null));

      if (mandatesError) {
        console.error("Error fetching mandates for KAM:", mandatesError);
        setFilteredAccounts([]);
        return;
      }

      // Get unique account IDs
      const accountIds = [...new Set((mandatesData || []).map((m: any) => m.account_id).filter(Boolean))];

      if (accountIds.length === 0) {
        setFilteredAccounts([]);
        return;
      }

      // Fetch account details
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("id, name")
        .in("id", accountIds)
        .order("name");

      if (accountsError) {
        console.error("Error fetching accounts:", accountsError);
        setFilteredAccounts([]);
      } else {
        setFilteredAccounts(accountsData || []);
      }
    } catch (error: any) {
      console.error("Error fetching accounts by KAM:", error);
      setFilteredAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchMandates = async () => {
    setLoadingMandates(true);
    try {
      // Get current user and KAM status (in case they changed)
      const currentUser = user;
      const currentIsKAM = hasRole("kam");
      
      let query = applyMandateTeamFilter(supabase
        .from("mandates")
        .select("id, project_code, project_name"));
      
      // If user is a KAM, filter by their KAM ID
      if (currentIsKAM && currentUser?.id) {
        query = query.eq("kam_id", currentUser.id);
      }
      
      const { data, error } = await query.order("project_code");

      if (error) {
        console.error("Error fetching mandates:", error);
        setMandates([]);
      } else {
        setMandates(data || []);
      }
    } catch (error: any) {
      console.error("Error fetching mandates:", error);
      setMandates([]);
    } finally {
      setLoadingMandates(false);
    }
  };

  useEffect(() => {
    if (!loading && userRoles.length > 0 && user !== undefined) {
      fetchMonthlyTargets();
      if (isKamOnly && user?.id) {
        setKams([{ id: user.id, full_name: fullName || "You" }]);
        fetchAccountsByKam(user.id);
      } else {
        fetchKams();
        if (isKAM && user?.id) {
          fetchAccountsByKam(user.id);
        } else {
          fetchAccounts();
        }
      }
      fetchMandates();
    }
    // Omit `user` from deps: session refresh replaces the object reference with the same id and would refetch on every tab focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userRoles.length, filterFinancialYear, isKAM, user?.id, mode, selectedTeam, effectiveTeam, canSelectAllTeams]);

  // Calculate Financial Year when month or year changes
  useEffect(() => {
    if (formData.month && formData.year) {
      const month = parseInt(formData.month);
      const year = parseInt(formData.year);
      if (!isNaN(month) && !isNaN(year)) {
        const financialYear = calculateFinancialYear(month, year);
        setFormData(prev => ({
          ...prev,
          financialYear: financialYear,
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        financialYear: "",
      }));
    }
  }, [formData.month, formData.year]);

  // Function to check and load existing target
  const checkAndLoadExistingTarget = async (formDataToCheck: MonthlyTargetFormData) => {
    // Only check if we have all required fields
    if (!formDataToCheck.month || !formDataToCheck.year) {
      return;
    }

    const month = parseInt(formDataToCheck.month);
    const year = parseInt(formDataToCheck.year);

    if (isNaN(month) || isNaN(year)) {
      return;
    }

    try {
      let query = supabase
        .from("monthly_targets")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .eq("target_type", mode);

      if (mode === "existing") {
        if (!formDataToCheck.mandateId) {
          return;
        }
        query = query.eq("mandate_id", formDataToCheck.mandateId).not("mandate_id", "is", null);
      } else if (mode === "new_cross_sell") {
        if (!formDataToCheck.kamId || !formDataToCheck.accountId) {
          return;
        }
        query = query
          .eq("kam_id", formDataToCheck.kamId)
          .eq("account_id", formDataToCheck.accountId)
          .not("kam_id", "is", null)
          .not("account_id", "is", null);
      } else {
        return;
      }

      const { data: existingTargets, error } = await query;

      if (error) {
        console.error("Error checking for existing target:", error);
        return;
      }

      if (existingTargets && existingTargets.length > 0) {
        const existingTarget = existingTargets[0];
        
        // Fetch account, mandate, and KAM names for display
        const accountMap: Record<string, string> = {};
        const mandateMap: Record<string, { project_code: string; project_name: string }> = {};
        const kamMap: Record<string, string> = {};

        if (existingTarget.account_id) {
          const { data: accountData } = await supabase
            .from("accounts")
            .select("id, name")
            .eq("id", existingTarget.account_id)
            .single();
          if (accountData) {
            accountMap[accountData.id] = accountData.name || "Unknown";
          }
        }

        if (existingTarget.mandate_id) {
          const { data: mandateData } = await applyMandateTeamFilter(supabase
            .from("mandates")
            .select("id, project_code, project_name")
            .eq("id", existingTarget.mandate_id)
            .single());
          if (mandateData) {
            mandateMap[mandateData.id] = {
              project_code: mandateData.project_code || "Unknown",
              project_name: mandateData.project_name || "Unknown",
            };
          }
        }

        if (existingTarget.kam_id) {
          const { data: kamData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", existingTarget.kam_id)
            .single();
          if (kamData) {
            kamMap[kamData.id] = kamData.full_name || "Unknown";
          }
        }

        // Create MonthlyTarget object with names
        const targetWithNames: MonthlyTarget = {
          ...existingTarget,
          accountName: existingTarget.account_id ? accountMap[existingTarget.account_id] : null,
          kamName: existingTarget.kam_id ? kamMap[existingTarget.kam_id] : null,
          mandateInfo: existingTarget.mandate_id ? mandateMap[existingTarget.mandate_id] : null,
        };

        // Set editing target and update form data
        setEditingTarget(targetWithNames);
        setFormData((prev) => ({
          ...prev,
          target: existingTarget.target?.toString() || "",
        }));
      } else {
        // No existing target found, clear editing state
        setEditingTarget(null);
      }
    } catch (error) {
      console.error("Error checking for existing target:", error);
    }
  };

  const handleInputChange = (field: keyof MonthlyTargetFormData, value: string) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };
      
      // Reset kamId, accountId and mandateId when targetType changes
      if (field === "targetType") {
        updated.kamId = "";
        updated.accountId = "";
        updated.mandateId = "";
        setFilteredAccounts([]);
        setEditingTarget(null);
      }
      
      // When KAM changes, fetch accounts for that KAM and reset accountId
      if (field === "kamId") {
        updated.accountId = "";
        if (value) {
          fetchAccountsByKam(value);
        } else {
          setFilteredAccounts([]);
        }
      }
      
      return updated;
    });
  };

  // Check for existing target when relevant form fields change
  useEffect(() => {
    if (!formDialogOpen) return; // Only check when dialog is open
    
    checkAndLoadExistingTarget(formData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.month, formData.year, formData.mandateId, formData.kamId, formData.accountId, formDialogOpen, mode]);

  useEffect(() => {
    if (formDialogOpen) {
      setFormData((prev) => ({
        ...prev,
        targetType: mode,
        ...(isKamOnly && user?.id && mode === "new_cross_sell"
          ? { kamId: user.id }
          : {}),
      }));
      if (isKamOnly && user?.id && mode === "new_cross_sell") {
        fetchAccountsByKam(user.id);
      }
    }
  }, [formDialogOpen, mode, isKamOnly, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate inputs
      if (!formData.month || !formData.year || !formData.target) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (mode === "new_cross_sell") {
        if (!isKamOnly && !formData.kamId) {
          toast({
            title: "Validation Error",
            description: "Please select a KAM for new cross sell target.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
        if (!formData.accountId) {
          toast({
            title: "Validation Error",
            description: "Please select an account for new cross sell target.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      if (mode === "existing" && !formData.mandateId) {
        toast({
          title: "Validation Error",
          description: "Please select a mandate for existing target.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const targetValue = parseFloat(formData.target);
      if (isNaN(targetValue) || targetValue <= 0) {
        toast({
          title: "Validation Error",
          description: "Target must be a positive number.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("You must be logged in to add a target");
      }

      // Double-check for existing target in case useEffect hasn't run yet
      // If we find one and we're not already editing it, load it and return early
      const month = parseInt(formData.month);
      const year = parseInt(formData.year);
      
      if (!editingTarget) {
        let checkQuery = supabase
          .from("monthly_targets")
          .select("*")
          .eq("month", month)
          .eq("year", year)
          .eq("target_type", mode);

        if (mode === "existing" && formData.mandateId) {
          checkQuery = checkQuery.eq("mandate_id", formData.mandateId).not("mandate_id", "is", null);
        } else if (
          mode === "new_cross_sell" &&
          (formData.kamId || (isKamOnly && user?.id)) &&
          formData.accountId
        ) {
          checkQuery = checkQuery
            .eq("kam_id", isKamOnly && user?.id ? user.id : formData.kamId)
            .eq("account_id", formData.accountId)
            .not("kam_id", "is", null)
            .not("account_id", "is", null);
        } else {
          // Can't check without required fields
        }

        const { data: existingTargets } = await checkQuery;

        if (existingTargets && existingTargets.length > 0) {
          // Found an existing target, load it into the form
          await checkAndLoadExistingTarget(formData);
          setSubmitting(false);
          toast({
            title: "Existing Target Found",
            description: "The existing target value has been loaded. You can modify it and save.",
          });
          return;
        }
      }

      // Prepare data for insertion
      // Expected table structure: monthly_targets
      // Columns: month (integer), year (integer), financial_year (text), target (numeric), target_type (text), account_id (uuid), mandate_id (uuid), created_by (uuid), created_at (timestamp)
      const targetData: any = {
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        financial_year: formData.financialYear,
        target: targetValue,
        target_type: mode,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      // Set account_id, mandate_id, and kam_id based on target type
      if (mode === "new_cross_sell") {
        targetData.account_id = formData.accountId;
        targetData.mandate_id = null;
        targetData.kam_id = isKamOnly && user?.id ? user.id : formData.kamId;
        targetData.nso_mail_id = null;
      } else if (mode === "existing") {
        targetData.mandate_id = formData.mandateId;
        targetData.account_id = null;

        // Derive KAM + NSO from the mandate
        const { data: mandateRow, error: mandateErr } = await applyMandateTeamFilter(supabase
          .from("mandates")
          .select("kam_id, type, new_sales_owner")
          .eq("id", formData.mandateId)
          .single());

        if (mandateErr) throw mandateErr;

        targetData.kam_id = mandateRow?.kam_id || null;
        targetData.nso_mail_id =
          mandateRow?.type === "New Acquisition" ? (mandateRow?.new_sales_owner || null) : null;
      }

      // Update or insert into monthly_targets table
      let error;
      if (editingTarget) {
        const { data: updatedRows, error: updateError } = await supabase
          .from("monthly_targets")
          .update({
            month: targetData.month,
            year: targetData.year,
            financial_year: targetData.financial_year,
            target: targetData.target,
            target_type: targetData.target_type,
            account_id: targetData.account_id,
            mandate_id: targetData.mandate_id,
            kam_id: targetData.kam_id,
            nso_mail_id: targetData.nso_mail_id,
          })
          .eq("id", editingTarget.id)
          .select("id");

        error = updateError;
        if (!error && (!updatedRows || updatedRows.length === 0)) {
          throw new Error(
            "Update was not applied. You may not have permission to edit this target."
          );
        }
      } else {
        const { data: insertedRows, error: insertError } = await supabase
          .from("monthly_targets")
          .insert([targetData])
          .select("id");

        error = insertError;
        if (!error && (!insertedRows || insertedRows.length === 0)) {
          throw new Error(
            "Save was not applied. You may not have permission to create this target."
          );
        }
      }

      if (error) {
        // If table doesn't exist, show a helpful message
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          toast({
            title: "Table Not Found",
            description: "The monthly_targets table needs to be created first. Please create the table in your database.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
        throw error;
      }

      toast({
        title: "Success!",
        description: `Target for ${getMonthName(parseInt(formData.month))} ${formData.year} (${formatFYLabel(formData.financialYear)}) ${editingTarget ? "updated" : "saved"} successfully.`,
      });

      // Reset form
      setFormData({
        month: "",
        year: "",
        target: "",
        financialYear: "",
        targetType: "",
        kamId: "",
        accountId: "",
        mandateId: "",
      });
      setFilteredAccounts([]);

      // Close dialog
      setFormDialogOpen(false);
      setEditingTarget(null);
      
      // Refresh targets list
      fetchMonthlyTargets();
    } catch (error: any) {
      console.error("Error saving target:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save target. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getMonthName = (month: number): string => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[month - 1] || '';
  };

  // Bulk upload functions
  const handleDownloadCrossSellTemplate = async () => {
    // Fetch KAM-Account relationships from mandates
    const { data: mandatesData } = await applyMandateTeamFilter(supabase
      .from("mandates")
      .select("kam_id, account_id")
      .not("kam_id", "is", null)
      .not("account_id", "is", null));

    // Create a map of KAM IDs to KAM names
    const kamNameMap: Record<string, string> = {};
    kams.forEach((kam) => {
      kamNameMap[kam.id] = kam.full_name;
    });
    if (isKamOnly && user?.id) {
      kamNameMap[user.id] = fullName || "You";
    }

    // Create a map of Account IDs to Account names
    const accountNameMap: Record<string, string> = {};
    allAccounts.forEach((account) => {
      accountNameMap[account.id] = account.name;
    });

    // Get unique KAM-Account combinations
    const kamAccountCombos: Array<{ kamName: string; accountName: string }> = [];
    const comboSet = new Set<string>();

    if (mandatesData) {
      mandatesData.forEach((mandate: any) => {
        const comboKey = `${mandate.kam_id}_${mandate.account_id}`;
        if (!comboSet.has(comboKey)) {
          comboSet.add(comboKey);
          const kamName = kamNameMap[mandate.kam_id] || "Unknown KAM";
          const accountName = accountNameMap[mandate.account_id] || "Unknown Account";
          kamAccountCombos.push({
            kamName,
            accountName,
          });
        }
      });
    }

    // Sort by KAM name, then by account name
    kamAccountCombos.sort((a, b) => {
      const kamCompare = a.kamName.localeCompare(b.kamName);
      if (kamCompare !== 0) return kamCompare;
      return a.accountName.localeCompare(b.accountName);
    });

    // Create headers: form fields + 2 empty columns + relation columns
    const formHeaders = ["Month", "Year", "Target Value", "KAM Name", "Account Name"];
    const relationHeaders = ["KAM Name (Reference)", "Account Name (Reference)"];
    const emptyColumns = ["", ""]; // 2 empty columns
    const allHeaders = [...formHeaders, ...emptyColumns, ...relationHeaders];

    // Create CSV content
    let csvContent = allHeaders.join(",") + "\n";
    
    // Add relation data rows (only in reference section, form fields stay empty)
    kamAccountCombos.forEach((combo) => {
      const row = [
        "", // Month
        "", // Year
        "", // Target Value
        "", // KAM Name (empty in form fields)
        "", // Account Name (empty in form fields)
        "", // Empty column 1
        "", // Empty column 2
        combo.kamName, // KAM Name (Reference)
        combo.accountName, // Account Name (Reference)
      ];
      csvContent += row.map((val) => `"${val}"`).join(",") + "\n";
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "cross_sell_targets_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Cross Sell Targets template downloaded successfully.",
    });
  };

  const handleDownloadExistingTemplate = () => {
    // Get all mandates (like in the dropdown)
    const mandateList: Array<{ mandateCode: string; mandateName: string }> = [];
    
    allMandates.forEach((mandate) => {
      mandateList.push({
        mandateCode: mandate.project_code,
        mandateName: mandate.project_name,
      });
    });

    // Sort by project code
    mandateList.sort((a, b) => a.mandateCode.localeCompare(b.mandateCode));

    // Create headers: form fields + 2 empty columns + relation columns
    const formHeaders = ["Month", "Year", "Target Value", "Mandate Project Code"];
    const relationHeaders = ["Mandate Project Code (Reference)", "Mandate Project Name (Reference)"];
    const emptyColumns = ["", ""]; // 2 empty columns
    const allHeaders = [...formHeaders, ...emptyColumns, ...relationHeaders];

    // Create CSV content
    let csvContent = allHeaders.join(",") + "\n";
    
    // Add relation data rows (only in reference section, form fields stay empty)
    mandateList.forEach((mandate) => {
      const row = [
        "", // Month
        "", // Year
        "", // Target Value
        "", // Mandate Project Code (empty in form fields)
        "", // Empty column 1
        "", // Empty column 2
        mandate.mandateCode, // Mandate Project Code (Reference)
        mandate.mandateName, // Mandate Project Name (Reference)
      ];
      csvContent += row.map((val) => `"${val}"`).join(",") + "\n";
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "existing_targets_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Existing Targets template downloaded successfully.",
    });
  };

  const handleBulkUploadTargets = async (file: File) => {
    try {
      const text = await file.text();
      const csvData = parseCSV(text);

      if (csvData.length === 0) {
        toast({
          title: "Error",
          description: "CSV file is empty or invalid.",
          variant: "destructive",
        });
        return;
      }

      // Fetch ALL accounts fresh from database for validation (to include newly added accounts and handle name variations)
      const { data: accountData } = await supabase
        .from("accounts")
        .select("id, name");

      // Create a normalized map: normalized name (trimmed, lowercase) -> account id
      // Also create a direct map for exact matches
      const accountMap: Record<string, string> = {};
      const accountMapNormalized: Record<string, string> = {};
      accountData?.forEach((acc) => {
        const normalizedName = acc.name.trim().toLowerCase();
        accountMap[acc.name.trim()] = acc.id; // Direct match with trimmed
        accountMap[acc.name] = acc.id; // Direct match with original
        accountMapNormalized[normalizedName] = acc.id; // Normalized match
      });

      // Fetch ALL KAMs fresh from database for validation (to handle name variations)
      const { data: kamData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam");

      // Create normalized maps for robust matching
      const kamMap: Record<string, string> = {};
      const kamMapNormalized: Record<string, string> = {};
      kamData?.forEach((kam) => {
        const normalizedName = kam.full_name.trim().toLowerCase();
        kamMap[kam.full_name.trim()] = kam.id;
        kamMap[kam.full_name] = kam.id;
        kamMapNormalized[normalizedName] = kam.id;
      });
      if (isKamOnly && user?.id && fullName) {
        kamMap[fullName.trim()] = user.id;
        kamMap[fullName] = user.id;
        kamMapNormalized[fullName.trim().toLowerCase()] = user.id;
      }

      // Fetch mandates fresh from database for validation
      const mandateCodes = selectedTargetType === "existing"
        ? [...new Set(csvData.map((row: any) => row["Mandate Project Code"]?.trim()).filter(Boolean))]
        : [];
      
      const { data: mandateData } = mandateCodes.length > 0
        ? await applyMandateTeamFilter(supabase
            .from("mandates")
            .select("id, project_code, kam_id, type, new_sales_owner")
            .in("project_code", mandateCodes))
        : { data: null };

      const mandateMap: Record<string, string> = {};
      mandateData?.forEach((mandate) => {
        mandateMap[mandate.project_code] = mandate.id;
      });

      // Map mandate_id -> derived fields
      const mandateDerivedMap: Record<string, { kam_id: string | null; nso_mail_id: string | null }> = {};
      mandateData?.forEach((mandate: any) => {
        mandateDerivedMap[mandate.id] = {
          kam_id: mandate.kam_id || null,
          nso_mail_id: mandate.type === "New Acquisition" ? (mandate.new_sales_owner || null) : null,
        };
      });

      // Fetch KAM-Account relationships from mandates for validation
      const { data: mandatesWithAccounts } = await applyMandateTeamFilter(supabase
        .from("mandates")
        .select("kam_id, account_id"));

      const kamAccountRelations = new Set<string>();
      if (mandatesWithAccounts) {
        mandatesWithAccounts.forEach((m: any) => {
          if (m.kam_id && m.account_id) {
            kamAccountRelations.add(`${m.kam_id}_${m.account_id}`);
          }
        });
      }

      // Fetch KAM-Mandate relationships for validation
      const kamMandateRelations = new Set<string>();
      allMandates.forEach((mandate) => {
        if (mandate.kam_id) {
          kamMandateRelations.add(`${mandate.kam_id}_${mandate.id}`);
        }
      });

      // Fetch existing targets to check for updates
      const financialYearString = fyKeyToFinancialYearString(filterFinancialYear);
      let existingTargetsQuery = supabase
        .from("monthly_targets")
        .select("id, month, year, target_type, kam_id, account_id, mandate_id");
      
      if (financialYearString) {
        existingTargetsQuery = existingTargetsQuery.eq("financial_year", financialYearString);
      }

      const { data: existingTargetsData } = await existingTargetsQuery;
      
      // Create a map of existing targets for quick lookup
      const existingTargetsMap = new Map<string, string>(); // key -> target id
      if (existingTargetsData) {
        existingTargetsData.forEach((target: any) => {
          let key = "";
          if (target.target_type === "new_cross_sell" && target.kam_id && target.account_id) {
            key = `${target.month}_${target.year}_new_cross_sell_${target.kam_id}_${target.account_id}`;
          } else if (target.target_type === "existing" && target.mandate_id) {
            key = `${target.month}_${target.year}_existing_${target.mandate_id}`;
          }
          if (key) {
            existingTargetsMap.set(key, target.id);
          }
        });
      }

      // Parse and validate each row
      const previewRows = csvData.map((row: any, index: number) => {
        const rowNumber = index + 2; // +2 because CSV has header and is 1-indexed
        const errors: string[] = [];

        // Validate Month
        if (!row["Month"] || row["Month"].trim() === "") {
          errors.push("Month is required");
        } else {
          const month = parseInt(row["Month"]);
          if (isNaN(month) || month < 1 || month > 12) {
            errors.push("Month must be a number between 1 and 12");
          }
        }

        // Validate Year
        if (!row["Year"] || row["Year"].trim() === "") {
          errors.push("Year is required");
        } else {
          const year = parseInt(row["Year"]);
          if (isNaN(year) || year < 2000 || year > 2100) {
            errors.push("Year must be a valid number");
          }
        }

        // Validate Target Value
        if (!row["Target Value"] || row["Target Value"].trim() === "") {
          errors.push("Target Value is required");
        } else {
          const target = parseFloat(row["Target Value"]);
          if (isNaN(target) || target <= 0) {
            errors.push("Target Value must be a positive number");
          }
        }

        if (selectedTargetType === "cross_sell") {
          // Validate KAM Name (case-insensitive, trimmed matching)
          const kamName = row["KAM Name"]?.trim();
          if (!kamName) {
            errors.push("KAM Name is required");
          } else {
            const normalizedKamName = kamName.toLowerCase();
            const kamId = kamMap[kamName] || kamMapNormalized[normalizedKamName];
            if (!kamId) {
              errors.push(`KAM "${kamName}" does not exist`);
            } else if (isKamOnly && user?.id && kamId !== user.id) {
              errors.push("You can only set pipeline targets for your own KAM account");
            }
          }

          // Validate Account Name (case-insensitive, trimmed matching)
          const accountName = row["Account Name"]?.trim();
          if (!accountName) {
            errors.push("Account Name is required");
          } else {
            const normalizedAccountName = accountName.toLowerCase();
            const accountId = accountMap[accountName] || accountMapNormalized[normalizedAccountName];
            if (!accountId) {
              errors.push(`Account "${accountName}" does not exist`);
            }
          }

          // Validate KAM-Account relationship
          if (kamName && accountName) {
            const normalizedKamName = kamName.toLowerCase();
            const kamId = kamMap[kamName] || kamMapNormalized[normalizedKamName];
            const normalizedAccountName = accountName.toLowerCase();
            const accountId = accountMap[accountName] || accountMapNormalized[normalizedAccountName];
            if (kamId && accountId && !kamAccountRelations.has(`${kamId}_${accountId}`)) {
              errors.push(`KAM "${kamName}" and Account "${accountName}" are not related (no mandate exists for this combination)`);
            }
          }
        } else if (selectedTargetType === "existing") {
          // Validate Mandate Project Code
          const mandateCode = row["Mandate Project Code"]?.trim();
          if (!mandateCode) {
            errors.push("Mandate Project Code is required");
          } else if (!mandateMap[mandateCode]) {
            errors.push(`Mandate with Project Code "${mandateCode}" does not exist`);
          }

          // Validate KAM-Mandate relationship (optional check - mandate should have a KAM)
          if (mandateCode && mandateMap[mandateCode]) {
            const mandateId = mandateMap[mandateCode];
            const mandate = mandateData?.find((m) => m.id === mandateId);
            if (mandate && !mandate.kam_id) {
              errors.push(`Mandate "${mandateCode}" does not have an associated KAM`);
            }
          }
        }

        // Check if this row will update an existing target
        let willUpdate = false;
        if (errors.length === 0) {
          const month = parseInt(row["Month"]);
          const year = parseInt(row["Year"]);
          
          if (!isNaN(month) && !isNaN(year)) {
            let lookupKey = "";
            if (selectedTargetType === "cross_sell") {
              const kamName = row["KAM Name"]?.trim();
              const accountName = row["Account Name"]?.trim();
              const normalizedKamName = kamName?.toLowerCase();
              const kamId = kamMap[kamName] || (normalizedKamName ? kamMapNormalized[normalizedKamName] : null);
              const normalizedAccountName = accountName?.toLowerCase();
              const accountId = accountMap[accountName] || (normalizedAccountName ? accountMapNormalized[normalizedAccountName] : null);
              
              if (kamId && accountId) {
                lookupKey = `${month}_${year}_new_cross_sell_${kamId}_${accountId}`;
              }
            } else {
              const mandateCode = row["Mandate Project Code"]?.trim();
              const mandateId = mandateMap[mandateCode];
              
              if (mandateId) {
                lookupKey = `${month}_${year}_existing_${mandateId}`;
              }
            }
            
            if (lookupKey && existingTargetsMap.has(lookupKey)) {
              willUpdate = true;
            }
          }
        }

        return {
          rowNumber,
          data: row,
          isValid: errors.length === 0,
          errors,
          willUpdate,
        };
      });

      // Store preview data and open dialog
      setCsvPreviewRows(previewRows);
      setCsvFileToUpload(file);
      setCsvPreviewOpen(true);
    } catch (error: any) {
      console.error("Error parsing CSV:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to parse CSV file. Please check the format.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmUpload = async () => {
    if (!csvFileToUpload || !selectedTargetType) return;

    setUploading(true);
    try {
      const text = await csvFileToUpload.text();
      const csvData = parseCSV(text);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to upload targets");
      }

      // Fetch accounts fresh from database (to include newly added accounts and handle name variations)
      const { data: accountData } = await supabase
        .from("accounts")
        .select("id, name");

      // Create normalized maps for robust matching
      const accountMap: Record<string, string> = {};
      const accountMapNormalized: Record<string, string> = {};
      accountData?.forEach((acc) => {
        const normalizedName = acc.name.trim().toLowerCase();
        accountMap[acc.name.trim()] = acc.id;
        accountMap[acc.name] = acc.id;
        accountMapNormalized[normalizedName] = acc.id;
      });

      // Fetch ALL KAMs fresh from database (to handle name variations)
      const { data: kamData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam");

      // Create normalized maps for robust matching
      const kamMap: Record<string, string> = {};
      const kamMapNormalized: Record<string, string> = {};
      kamData?.forEach((kam) => {
        const normalizedName = kam.full_name.trim().toLowerCase();
        kamMap[kam.full_name.trim()] = kam.id;
        kamMap[kam.full_name] = kam.id;
        kamMapNormalized[normalizedName] = kam.id;
      });
      if (isKamOnly && user?.id && fullName) {
        kamMap[fullName.trim()] = user.id;
        kamMap[fullName] = user.id;
        kamMapNormalized[fullName.trim().toLowerCase()] = user.id;
      }

      // Fetch mandates fresh from database
      const mandateCodes = selectedTargetType === "existing"
        ? [...new Set(csvData.map((row: any) => row["Mandate Project Code"]?.trim()).filter(Boolean))]
        : [];
      
      const { data: mandateData } = mandateCodes.length > 0
        ? await applyMandateTeamFilter(supabase
            .from("mandates")
            .select("id, project_code, kam_id, type, new_sales_owner")
            .in("project_code", mandateCodes))
        : { data: null };

      const mandateMap: Record<string, string> = {};
      const mandateDerivedMap: Record<
        string,
        { kam_id: string | null; nso_mail_id: string | null }
      > = {};
      mandateData?.forEach((mandate: any) => {
        mandateMap[mandate.project_code] = mandate.id;
        mandateDerivedMap[mandate.id] = {
          kam_id: mandate.kam_id || null,
          nso_mail_id:
            mandate.type === "New Acquisition"
              ? mandate.new_sales_owner || null
              : null,
        };
      });

      // Prepare data for insertion
      const targetsToInsert = csvData
        .map((row: any) => {
          const month = parseInt(row["Month"]);
          const year = parseInt(row["Year"]);
          const target = parseFloat(row["Target Value"]);
          const financialYear = calculateFinancialYear(month, year);

          if (selectedTargetType === "cross_sell") {
            const kamName = row["KAM Name"]?.trim();
            const accountName = row["Account Name"]?.trim();
            const normalizedKamName = kamName?.toLowerCase();
            const kamId = kamMap[kamName] || (normalizedKamName ? kamMapNormalized[normalizedKamName] : null);
            const normalizedAccountName = accountName?.toLowerCase();
            const accountId = accountMap[accountName] || (normalizedAccountName ? accountMapNormalized[normalizedAccountName] : null);

            if (!kamId || !accountId) return null;

            return {
              month,
              year,
              financial_year: financialYear,
              target,
              target_type: "new_cross_sell" as const,
              kam_id: isKamOnly && user?.id ? user.id : kamId,
              account_id: accountId,
              mandate_id: null,
              created_by: user.id,
              created_at: new Date().toISOString(),
            };
          } else {
            const mandateCode = row["Mandate Project Code"]?.trim();
            const mandateId = mandateMap[mandateCode];

            if (!mandateId) return null;

            return {
              month,
              year,
              financial_year: financialYear,
              target,
              target_type: "existing" as const,
              kam_id: mandateDerivedMap[mandateId]?.kam_id || null,
              nso_mail_id: mandateDerivedMap[mandateId]?.nso_mail_id || null,
              account_id: null,
              mandate_id: mandateId,
              created_by: user.id,
              created_at: new Date().toISOString(),
            };
          }
        })
        .filter((target: any) => target !== null);

      if (targetsToInsert.length === 0) {
        throw new Error("No valid targets to insert");
      }

      // Use upsert to handle duplicates
      // First try to find existing targets and update them, otherwise insert
      for (const target of targetsToInsert) {
        let query = supabase
          .from("monthly_targets")
          .select("id")
          .eq("month", target.month)
          .eq("year", target.year)
          .eq("target_type", target.target_type);

        if (target.target_type === "new_cross_sell") {
          query = query.eq("kam_id", target.kam_id).eq("account_id", target.account_id);
        } else {
          query = query.eq("mandate_id", target.mandate_id);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
          const { data: updatedRows, error: updateError } = await supabase
            .from("monthly_targets")
            .update({
              target: target.target,
              financial_year: target.financial_year,
            })
            .eq("id", existing.id)
            .select("id");

          if (updateError) throw updateError;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error(
              "One or more updates were not applied. You may not have permission to edit these targets."
            );
          }
        } else {
          const { data: insertedRows, error: insertError } = await supabase
            .from("monthly_targets")
            .insert([target])
            .select("id");
          if (insertError) throw insertError;
          if (!insertedRows || insertedRows.length === 0) {
            throw new Error(
              "One or more rows were not saved. You may not have permission to create these targets."
            );
          }
        }
      }

      toast({
        title: "Success!",
        description: `Successfully uploaded ${targetsToInsert.length} target(s).`,
      });

      setCsvPreviewOpen(false);
      setCsvFileToUpload(null);
      setBulkUploadDialogOpen(false);
      setSelectedTargetType(null);
      
      // Refresh targets list
      fetchMonthlyTargets();
    } catch (error: any) {
      console.error("Error uploading targets:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload targets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Generate year options (current year - 2 to current year + 2)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = currentYear - 2; i <= currentYear + 2; i++) {
    yearOptions.push(i);
  }

  // Show loading state while checking permissions
  if (loading || userRoles.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const hasAccess =
    hasRole("manager") ||
    hasRole("leadership") ||
    hasRole("superadmin") ||
    hasRole("kam");

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canMutatePortal ? (
          <>
          <Dialog
            open={bulkUploadDialogOpen}
            onOpenChange={(open) => {
              setBulkUploadDialogOpen(open);
              if (open) {
                setSelectedTargetType(
                  mode === "existing" ? "existing" : "cross_sell"
                );
              } else {
                setSelectedTargetType(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                CSV upload
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {mode === "existing"
                    ? "Mandate targets CSV"
                    : "Pipeline deals targets CSV"}
                </DialogTitle>
                <DialogDescription>
                  For {formatFYLabel(filterFinancialYear)}: download the template,
                  then upload completed rows.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={
                    mode === "new_cross_sell"
                      ? handleDownloadCrossSellTemplate
                      : handleDownloadExistingTemplate
                  }
                >
                  Download template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedTargetType(
                      mode === "existing" ? "existing" : "cross_sell"
                    );
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".csv";
                    input.onchange = (e: Event) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleBulkUploadTargets(file);
                      }
                    };
                    input.click();
                  }}
                >
                  Upload CSV
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={formDialogOpen} onOpenChange={(open) => {
          setFormDialogOpen(open);
          if (!open) {
            // Reset form and editing state when dialog closes
            setFormData({
              month: "",
              year: "",
              target: "",
              financialYear: "",
              targetType: "",
              kamId: "",
              accountId: "",
              mandateId: "",
            });
            setEditingTarget(null);
            setAccountSearch("");
            setMandateSearch("");
            setFilteredAccounts([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {mode === "existing" ? "Add mandate target" : "Add pipeline target"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingTarget
                    ? mode === "existing"
                      ? "Edit mandate target"
                      : "Edit pipeline target"
                    : mode === "existing"
                      ? "Add mandate target"
                      : "Add pipeline target"}
                </DialogTitle>
                <DialogDescription>
                  {editingTarget
                    ? "Update the target for this month. Financial year is derived from month and year."
                    : "Add a monthly target. Financial year is derived from month and year."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {mode === "new_cross_sell" ? (
                  <>
                    {isKamOnly ? (
                      <div className="grid gap-2">
                        <Label>KAM</Label>
                        <p className="text-sm text-muted-foreground">
                          {fullName || "Your account"}
                        </p>
                      </div>
                    ) : (
                    <div className="grid gap-2">
                      <Label htmlFor="kamId">KAM *</Label>
                      <Select
                        value={formData.kamId}
                        onValueChange={(value) => handleInputChange("kamId", value)}
                        required
                      >
                        <SelectTrigger id="kamId">
                          <SelectValue placeholder="Select KAM" />
                        </SelectTrigger>
                        <SelectContent>
                          {kams.length > 0 ? (
                            kams.map((kam) => (
                              <SelectItem key={kam.id} value={kam.id}>
                                {kam.full_name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              {loadingKams ? "Loading KAMs..." : "No KAMs available"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                    {(formData.kamId || isKamOnly) && (
                      <div className="grid gap-2">
                        <Label htmlFor="accountId">Account *</Label>
                        <Select
                          value={formData.accountId}
                          onValueChange={(value) => handleInputChange("accountId", value)}
                          required
                          disabled={(!formData.kamId && !isKamOnly) || loadingAccounts}
                        >
                          <SelectTrigger id="accountId">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                placeholder="Search accounts..."
                                value={accountSearch}
                                onChange={(e) => setAccountSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8"
                              />
                            </div>
                            {filteredAccounts.length > 0 ? (
                              filteredAccounts
                                .filter((account) =>
                                  account.name.toLowerCase().includes(accountSearch.toLowerCase())
                                )
                                .map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.name}
                                  </SelectItem>
                                ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                {loadingAccounts ? "Loading accounts..." : "No accounts available for this KAM"}
                              </div>
                            )}
                            {filteredAccounts.length > 0 && filteredAccounts.filter((account) =>
                              account.name.toLowerCase().includes(accountSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No accounts found
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                ) : null}
                {mode === "existing" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="mandateId">Mandate *</Label>
                    <Select
                      value={formData.mandateId}
                      onValueChange={(value) => handleInputChange("mandateId", value)}
                      required
                    >
                      <SelectTrigger id="mandateId">
                        <SelectValue placeholder="Select mandate" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Search mandates..."
                            value={mandateSearch}
                            onChange={(e) => setMandateSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                        </div>
                        {mandates.length > 0 ? (
                          mandates
                            .filter((mandate) =>
                              `${mandate.project_code} ${mandate.project_name}`.toLowerCase().includes(mandateSearch.toLowerCase())
                            )
                            .map((mandate) => (
                              <SelectItem key={mandate.id} value={mandate.id}>
                                {mandate.project_code} - {mandate.project_name}
                              </SelectItem>
                            ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {loadingMandates ? "Loading mandates..." : "No mandates available"}
                          </div>
                        )}
                        {mandates.length > 0 && mandates.filter((mandate) =>
                          `${mandate.project_code} ${mandate.project_name}`.toLowerCase().includes(mandateSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No mandates found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="month">Month *</Label>
                  <Select
                    value={formData.month}
                    onValueChange={(value) => handleInputChange("month", value)}
                    required
                  >
                    <SelectTrigger id="month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">January</SelectItem>
                      <SelectItem value="2">February</SelectItem>
                      <SelectItem value="3">March</SelectItem>
                      <SelectItem value="4">April</SelectItem>
                      <SelectItem value="5">May</SelectItem>
                      <SelectItem value="6">June</SelectItem>
                      <SelectItem value="7">July</SelectItem>
                      <SelectItem value="8">August</SelectItem>
                      <SelectItem value="9">September</SelectItem>
                      <SelectItem value="10">October</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="year">Year *</Label>
                  <Select
                    value={formData.year}
                    onValueChange={(value) => handleInputChange("year", value)}
                    required
                  >
                    <SelectTrigger id="year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="target">Target Value *</Label>
                  <Input
                    id="target"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter target value"
                    value={formData.target}
                    onChange={(e) => handleInputChange("target", e.target.value)}
                    required
                  />
                </div>
                {formData.financialYear && (
                  <div className="grid gap-2">
                    <Label>Financial Year (Auto-calculated)</Label>
                    <div className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
                      {formatFYLabel(formData.financialYear)}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !formData.month ||
                    !formData.year ||
                    !formData.target ||
                    (mode === "new_cross_sell" &&
                      ((!formData.kamId && !isKamOnly) || !formData.accountId)) ||
                    (mode === "existing" && !formData.mandateId)
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingTarget ? "Updating..." : "Saving..."}
                    </>
                  ) : (
                    editingTarget ? "Update Target" : "Save Target"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
          </>
        ) : null}
      </div>

      {mode === "existing" ? (
      <Card>
        <CardHeader>
          <CardTitle>Existing Targets</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTargets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-background min-w-[200px] w-[200px]">Mandate</TableHead>
                    <TableHead className="sticky left-[200px] z-10 bg-background min-w-[150px] w-[150px]">Mandate Type</TableHead>
                    <TableHead className="sticky left-[350px] z-10 bg-background min-w-[200px] w-[200px]">KAM/NSO</TableHead>
                    {monthColumns.map((col) => (
                      <TableHead key={col.key} className="text-center min-w-[100px]">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMandates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={monthColumns.length + 3} className="text-center text-muted-foreground py-8">
                        No mandates available
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {allMandates.map((mandate) => (
                        <TableRow key={mandate.id}>
                          <TableCell className="font-medium sticky left-0 z-10 bg-background min-w-[200px] w-[200px]">
                            {mandate.project_code} - {mandate.project_name}
                          </TableCell>
                          <TableCell className="font-medium sticky left-[200px] z-10 bg-background min-w-[150px] w-[150px]">
                            {mandate.type || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="font-medium sticky left-[350px] z-10 bg-background min-w-[200px] w-[200px]">
                            <div className="flex flex-col">
                              <span>{mandate.kamName || <span className="text-muted-foreground">-</span>}</span>
                              {mandate.type === "New Acquisition" && mandate.new_sales_owner && (
                                <span className="text-xs text-muted-foreground mt-1">
                                  {mandate.nsoInfo
                                    ? `${mandate.nsoInfo.first_name} ${mandate.nsoInfo.last_name}`
                                    : mandate.new_sales_owner}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {monthColumns.map((col) => {
                            const targetValue = existingTargetsData[mandate.id]?.[col.key] || 0;
                            return (
                              <TableCell key={col.key} className="text-center">
                                {targetValue > 0 ? (
                                  <span className="font-semibold">
                                    {formatNumber(Math.round(targetValue))}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell className="font-bold sticky left-0 z-10 bg-muted/50 min-w-[200px] w-[200px]">
                          Total
                        </TableCell>
                        <TableCell className="font-bold sticky left-[200px] z-10 bg-muted/50 min-w-[150px] w-[150px]">
                          -
                        </TableCell>
                        <TableCell className="font-bold sticky left-[350px] z-10 bg-muted/50 min-w-[200px] w-[200px]">
                          -
                        </TableCell>
                        {monthColumns.map((col) => {
                          // Calculate sum for this month across all mandates
                          const monthSum = Object.values(existingTargetsData).reduce((sum, mandateData) => {
                            return sum + (mandateData[col.key] || 0);
                          }, 0);
                          return (
                            <TableCell key={col.key} className="text-center font-bold">
                              {monthSum > 0 ? (
                                <span>
                                  {formatNumber(Math.round(monthSum))}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {mode === "new_cross_sell" ? (
      <Card>
        <CardHeader>
          <CardTitle>Cross Sell Targets</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTargets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-background min-w-[200px] w-[200px]">KAM</TableHead>
                    <TableHead className="sticky left-[200px] z-10 bg-background min-w-[200px] w-[200px]">Account</TableHead>
                    {monthColumns.map((col) => (
                      <TableHead key={col.key} className="text-center min-w-[100px]">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossSellKamAccountCombos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={monthColumns.length + 2} className="text-center text-muted-foreground py-8">
                        No cross sell targets available
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {crossSellKamAccountCombos.map((combo) => {
                        const compositeKey = `${combo.kamId}_${combo.accountId}`;
                        return (
                          <TableRow key={compositeKey}>
                            <TableCell className="font-medium sticky left-0 z-10 bg-background min-w-[200px] w-[200px]">
                              {combo.kamName}
                            </TableCell>
                            <TableCell className="font-medium sticky left-[200px] z-10 bg-background min-w-[200px] w-[200px]">
                              {combo.accountName}
                            </TableCell>
                            {monthColumns.map((col) => {
                              const targetValue = crossSellTargetsData[compositeKey]?.[col.key] || 0;
                              return (
                                <TableCell key={col.key} className="text-center">
                                  {targetValue > 0 ? (
                                    <span className="font-semibold">
                                      {formatNumber(Math.round(targetValue))}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell className="font-bold sticky left-0 z-10 bg-muted/50 min-w-[200px] w-[200px]">
                          Total
                        </TableCell>
                        <TableCell className="font-bold sticky left-[200px] z-10 bg-muted/50 min-w-[200px] w-[200px]">
                          -
                        </TableCell>
                        {monthColumns.map((col) => {
                          // Calculate sum for this month across all KAM-Account combinations
                          const monthSum = Object.values(crossSellTargetsData).reduce((sum, comboData) => {
                            return sum + (comboData[col.key] || 0);
                          }, 0);
                          return (
                            <TableCell key={col.key} className="text-center font-bold">
                              {monthSum > 0 ? (
                                <span>
                                  {formatNumber(Math.round(monthSum))}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {/* CSV Preview Dialog */}
      <CSVPreviewDialog
        open={csvPreviewOpen}
        onOpenChange={setCsvPreviewOpen}
        rows={csvPreviewRows}
        onConfirm={handleConfirmUpload}
        onCancel={() => {
          setCsvPreviewOpen(false);
          setCsvFileToUpload(null);
        }}
        loading={uploading}
        title={`Upload ${mode === "new_cross_sell" ? "pipeline (cross sell)" : "mandate (existing)"} targets`}
      />
    </div>
  );
}

