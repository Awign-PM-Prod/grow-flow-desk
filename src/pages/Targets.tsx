import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Helper function to calculate Financial Year based on selected month and year
// Logic: Jan-Mar use (year-1)-(year), Apr-Dec use (year)-(year+1)
const calculateFinancialYear = (month: number, year: number): string => {
  if (!month || !year) return "";
  
  if (month >= 1 && month <= 3) {
    // Jan, Feb, March: Use (year-1)-(year)
    const startYear = year - 1;
    const endYear = year.toString().slice(-2);
    return `${startYear}-${endYear}`;
  } else {
    // April to December: Use (year)-(year+1)
    const startYear = year;
    const endYear = (year + 1).toString().slice(-2);
    return `${startYear}-${endYear}`;
  }
};

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

// Helper function to convert FY string to financial_year format (e.g., "FY25" -> "2025-26")
const convertFYToFinancialYear = (fyString: string): string => {
  const yearMatch = fyString.match(/FY(\d{2})/);
  if (!yearMatch) {
    return "";
  }
  
  const yearDigits = parseInt(yearMatch[1], 10);
  const startYear = 2000 + yearDigits;
  const endYear = (startYear + 1).toString().slice(-2);
  
  return `${startYear}-${endYear}`;
};

// Helper function to get month columns for a specific FY
// Returns all 12 months of the financial year (April to March) in order
const getFinancialYearMonths = (fyString: string): Array<{ month: number; year: number; key: string; label: string }> => {
  const yearMatch = fyString.match(/FY(\d{2})/);
  if (!yearMatch) {
    return [];
  }
  
  const yearDigits = parseInt(yearMatch[1], 10);
  const fyStartYear = 2000 + yearDigits;
  const fyEndYear = fyStartYear + 1;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthColumns: Array<{ month: number; year: number; key: string; label: string }> = [];
  
  // Financial year runs from April (month 4) to March (month 3 of next year)
  // Always show all 12 months regardless of current date
  
  // April to December of FY start year
  for (let month = 4; month <= 12; month++) {
    monthColumns.push({
      month,
      year: fyStartYear,
      key: `${fyStartYear}-${String(month).padStart(2, '0')}`,
      label: `${monthNames[month - 1]} ${fyStartYear}`,
    });
  }
  
  // January to March of FY end year (next year)
  for (let month = 1; month <= 3; month++) {
    monthColumns.push({
      month,
      year: fyEndYear,
      key: `${fyEndYear}-${String(month).padStart(2, '0')}`,
      label: `${monthNames[month - 1]} ${fyEndYear}`,
    });
  }
  
  return monthColumns;
};

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

export default function Targets() {
  const { hasRole, loading, userRoles } = useAuth();
  const navigate = useNavigate();
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
  
  // FY filter state
  const [filterFinancialYear, setFilterFinancialYear] = useState<string>(() => {
    return getCurrentFinancialYear();
  });
  
  // Data structures for the new table view
  const [existingTargetsData, setExistingTargetsData] = useState<Record<string, Record<string, number>>>({}); // mandateId -> monthKey -> target
  const [crossSellTargetsData, setCrossSellTargetsData] = useState<Record<string, Record<string, number>>>({}); // kamId_accountId -> monthKey -> target
  const [crossSellKamAccountCombos, setCrossSellKamAccountCombos] = useState<Array<{ kamId: string; kamName: string; accountId: string; accountName: string }>>([]); // List of unique KAM-account combinations
  const [allMandates, setAllMandates] = useState<Array<{ id: string; project_code: string; project_name: string }>>([]);
  const [allAccounts, setAllAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [monthColumns, setMonthColumns] = useState<Array<{ month: number; year: number; key: string; label: string }>>([]);
  const [kams, setKams] = useState<KAM[]>([]);
  const [loadingKams, setLoadingKams] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loadingMandates, setLoadingMandates] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [mandateSearch, setMandateSearch] = useState("");

  const fetchMonthlyTargets = async () => {
    setLoadingTargets(true);
    try {
      // Calculate month columns for selected FY
      const calculatedMonthColumns = getFinancialYearMonths(filterFinancialYear);
      setMonthColumns(calculatedMonthColumns);
      
      // Convert FY filter to financial_year format used in monthly_targets (e.g., "FY25" -> "2025-26")
      const financialYearString = convertFYToFinancialYear(filterFinancialYear);
      
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
      const { data: allMandatesData } = await supabase
        .from("mandates")
        .select("id, project_code, project_name")
        .order("project_code");
      
      setAllMandates(allMandatesData || []);

      // Fetch all accounts for cross sell targets table
      const { data: allAccountsData } = await supabase
        .from("accounts")
        .select("id, name")
        .order("name");
      
      setAllAccounts(allAccountsData || []);

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
        const { data: mandateData } = await supabase
          .from("mandates")
          .select("id, project_code, project_name")
          .in("id", mandateIds);

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

      // Add account, mandate, and KAM names to targets (for form editing)
      const targetsWithNames = (data || []).map((target: any) => ({
        ...target,
        accountName: target.account_id ? accountMap[target.account_id] : null,
        kamName: target.kam_id ? kamMap[target.kam_id] : null,
        mandateInfo: target.mandate_id ? mandateMap[target.mandate_id] : null,
      }));

      setMonthlyTargets(targetsWithNames);

      // Organize targets by type for table display
      const existingData: Record<string, Record<string, number>> = {};
      const crossSellData: Record<string, Record<string, number>> = {}; // kamId_accountId -> monthKey -> target
      const kamAccountComboSet = new Set<string>(); // Track unique KAM-account combinations

      (data || []).forEach((target: any) => {
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
        const [kamId, accountId] = compositeKey.split('_');
        kamAccountCombos.push({
          kamId,
          kamName: kamMap[kamId] || "Unknown KAM",
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
      const { data: mandatesData, error: mandatesError } = await supabase
        .from("mandates")
        .select("account_id")
        .eq("kam_id", kamId)
        .not("account_id", "is", null);

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
      const { data, error } = await supabase
        .from("mandates")
        .select("id, project_code, project_name")
        .order("project_code");

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
    if (!loading && userRoles.length > 0) {
      // Only allow manager, leadership, and superadmin roles
      // KAM users should not have access
      const hasAccess = hasRole("manager") || hasRole("leadership") || hasRole("superadmin");
      
      if (!hasAccess) {
        navigate("/dashboard");
      } else {
        // Fetch targets, KAMs, accounts, and mandates when user has access
        fetchMonthlyTargets();
        fetchKams();
        fetchAccounts();
        fetchMandates();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userRoles.length, navigate, filterFinancialYear]);

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
    if (!formDataToCheck.month || !formDataToCheck.year || !formDataToCheck.targetType) {
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
        .eq("year", year);

      if (formDataToCheck.targetType === "existing") {
        if (!formDataToCheck.mandateId) {
          return;
        }
        query = query.eq("mandate_id", formDataToCheck.mandateId).not("mandate_id", "is", null);
      } else if (formDataToCheck.targetType === "new_cross_sell") {
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
          const { data: mandateData } = await supabase
            .from("mandates")
            .select("id, project_code, project_name")
            .eq("id", existingTarget.mandate_id)
            .single();
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
  }, [formData.month, formData.year, formData.targetType, formData.mandateId, formData.kamId, formData.accountId, formDialogOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate inputs
      if (!formData.month || !formData.year || !formData.target || !formData.targetType) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate type-specific fields
      if (formData.targetType === "new_cross_sell") {
        if (!formData.kamId) {
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

      if (formData.targetType === "existing" && !formData.mandateId) {
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
          .eq("year", year);

        if (formData.targetType === "existing" && formData.mandateId) {
          checkQuery = checkQuery.eq("mandate_id", formData.mandateId).not("mandate_id", "is", null);
        } else if (formData.targetType === "new_cross_sell" && formData.kamId && formData.accountId) {
          checkQuery = checkQuery
            .eq("kam_id", formData.kamId)
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
        target_type: (formData.targetType === 'new_cross_sell' || formData.targetType === 'existing') ? formData.targetType : null,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      // Set account_id, mandate_id, and kam_id based on target type
      if (formData.targetType === "new_cross_sell") {
        targetData.account_id = formData.accountId;
        targetData.mandate_id = null;
        targetData.kam_id = formData.kamId;
      } else if (formData.targetType === "existing") {
        targetData.mandate_id = formData.mandateId;
        targetData.account_id = null;
        targetData.kam_id = null;
      }

      // Update or insert into monthly_targets table
      let error;
      if (editingTarget) {
        // Update existing target
        const { error: updateError } = await supabase
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
          })
          .eq("id", editingTarget.id);
        
        error = updateError;
      } else {
        // Insert new target
        const { error: insertError } = await supabase
          .from("monthly_targets")
          .insert([targetData]);
        
        error = insertError;
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
        description: `Target for ${getMonthName(parseInt(formData.month))} ${formData.year} (FY: ${formData.financialYear}) ${editingTarget ? "updated" : "saved"} successfully.`,
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

  // Check if user has access (manager, leadership, or superadmin)
  const hasAccess = hasRole("manager") || hasRole("leadership") || hasRole("superadmin");

  if (!hasAccess) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Targets</h1>
          <p className="text-muted-foreground">
            Manage your sales targets and goals.
          </p>
        </div>
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
              Add Monthly Target
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingTarget ? "Edit Monthly Target" : "Add Monthly Target"}</DialogTitle>
                <DialogDescription>
                  {editingTarget 
                    ? "Update the target for this month. The financial year will be calculated automatically."
                    : "Add a target for a specific month. The financial year will be calculated automatically."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="targetType">Target Type *</Label>
                  <Select
                    value={formData.targetType}
                    onValueChange={(value) => handleInputChange("targetType", value)}
                    required
                  >
                    <SelectTrigger id="targetType">
                      <SelectValue placeholder="Select target type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_cross_sell">New cross sell target</SelectItem>
                      <SelectItem value="existing">Existing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.targetType === "new_cross_sell" && (
                  <>
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
                    {formData.kamId && (
                      <div className="grid gap-2">
                        <Label htmlFor="accountId">Account *</Label>
                        <Select
                          value={formData.accountId}
                          onValueChange={(value) => handleInputChange("accountId", value)}
                          required
                          disabled={!formData.kamId || loadingAccounts}
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
                )}
                {formData.targetType === "existing" && (
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
                )}
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
                      {formData.financialYear}
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
                <Button type="submit" disabled={submitting || !formData.month || !formData.year || !formData.target || !formData.targetType || (formData.targetType === "new_cross_sell" && (!formData.kamId || !formData.accountId)) || (formData.targetType === "existing" && !formData.mandateId)}>
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
        </div>
      </div>

      {/* Existing Targets Table */}
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
                    <TableHead className="sticky left-0 z-10 bg-background">Mandate</TableHead>
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
                      <TableCell colSpan={monthColumns.length + 1} className="text-center text-muted-foreground py-8">
                        No mandates available
                      </TableCell>
                    </TableRow>
                  ) : (
                    allMandates.map((mandate) => (
                      <TableRow key={mandate.id}>
                        <TableCell className="font-medium sticky left-0 z-10 bg-background">
                          {mandate.project_code} - {mandate.project_name}
                        </TableCell>
                        {monthColumns.map((col) => {
                          const targetValue = existingTargetsData[mandate.id]?.[col.key] || 0;
                          return (
                            <TableCell key={col.key} className="text-center">
                              {targetValue > 0 ? (
                                <span className="font-semibold">
                                  {Math.round(targetValue).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross Sell Targets Table */}
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
                    <TableHead className="sticky left-0 z-10 bg-background">KAM</TableHead>
                    <TableHead className="sticky left-[120px] z-10 bg-background">Account</TableHead>
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
                    crossSellKamAccountCombos.map((combo) => {
                      const compositeKey = `${combo.kamId}_${combo.accountId}`;
                      return (
                        <TableRow key={compositeKey}>
                          <TableCell className="font-medium sticky left-0 z-10 bg-background">
                            {combo.kamName}
                          </TableCell>
                          <TableCell className="font-medium sticky left-[120px] z-10 bg-background">
                            {combo.accountName}
                          </TableCell>
                          {monthColumns.map((col) => {
                            const targetValue = crossSellTargetsData[compositeKey]?.[col.key] || 0;
                            return (
                              <TableCell key={col.key} className="text-center">
                                {targetValue > 0 ? (
                                  <span className="font-semibold">
                                    {Math.round(targetValue).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

