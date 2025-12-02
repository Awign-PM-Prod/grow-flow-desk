import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Upload, FileText } from "lucide-react";
import { convertToCSV, downloadCSV, formatTimestampForCSV, formatDateForCSV, downloadCSVTemplate, parseCSV } from "@/lib/csv-export";
import { HighlightedText } from "@/components/HighlightedText";
import { CSVPreviewDialog } from "@/components/CSVPreviewDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

type ViewMode = "form" | "view";

interface MandateFormData {
  // Project Info
  projectCode: string;
  projectName: string;
  accountId: string;
  kamId: string;
  lob: string;
  useCase: string;
  subUseCase: string;
  type: string;

  // Handover Info
  newSalesOwner: string;
  handoverMonthlyVolume: string;
  handoverCommercialPerHead: string;
  handoverMcv: string;
  prjDurationMonths: string;
  handoverAcv: string;
  handoverPrjType: string;

  // Revenue Info
  revenueMonthlyVolume: string;
  revenueCommercialPerHead: string;
  revenueMcv: string;
  revenueAcv: string;
  revenuePrjType: string;

  // Mandate Checker
  mandateHealth: string;
  upsellConstraint: string;
  upsellConstraintType: string;
  upsellConstraintSub: string;
  upsellConstraintSub2: string;
  clientBudgetTrend: string;
  awignSharePercent: string;
  retentionType: string;

  // Upsell Action Status
  upsellActionStatus: string;
}

// Upsell Constraint Masterlist Data Structure
const upsellConstraintMapping: Record<string, Record<string, Record<string, string[]>>> = {
  "YES": {
    "Internal": {
      "Profitability": ["GM too low", "CoC (Cost of Capital too high)"],
      "Delivery": ["Schedule too tight", "Location too remote"],
      "Others": [], // Free text input
    },
    "External": {
      "Not enough demand": ["-"],
      "Collection Issue": ["-"],
      "Others": [], // Free text input
    },
  },
  "NO": {
    "-": {
      "-": ["-"],
    },
  },
};

// Helper functions to get upsell constraint options
const getUpsellConstraintTypes = (upsellConstraint: string): string[] => {
  if (!upsellConstraint || !upsellConstraintMapping[upsellConstraint]) return [];
  return Object.keys(upsellConstraintMapping[upsellConstraint]);
};

const getUpsellConstraintSubs = (upsellConstraint: string, constraintType: string): string[] => {
  if (!upsellConstraint || !constraintType || !upsellConstraintMapping[upsellConstraint] || !upsellConstraintMapping[upsellConstraint][constraintType]) return [];
  return Object.keys(upsellConstraintMapping[upsellConstraint][constraintType]);
};

const getUpsellConstraintSub2s = (upsellConstraint: string, constraintType: string, constraintSub: string): string[] => {
  if (!upsellConstraint || !constraintType || !constraintSub || !upsellConstraintMapping[upsellConstraint] || !upsellConstraintMapping[upsellConstraint][constraintType] || !upsellConstraintMapping[upsellConstraint][constraintType][constraintSub]) return [];
  const sub2Options = upsellConstraintMapping[upsellConstraint][constraintType][constraintSub];
  // If empty array, it means free text input
  // Filter out "-" option as it should not be selectable
  return sub2Options.length > 0 ? sub2Options.filter(opt => opt !== "-") : [];
};

const isFreeTextSub2 = (upsellConstraint: string, constraintType: string, constraintSub: string): boolean => {
  if (!upsellConstraint || !constraintType || !constraintSub || !upsellConstraintMapping[upsellConstraint] || !upsellConstraintMapping[upsellConstraint][constraintType] || !upsellConstraintMapping[upsellConstraint][constraintType][constraintSub]) return false;
  const sub2Options = upsellConstraintMapping[upsellConstraint][constraintType][constraintSub];
  // Empty array means free text input
  return sub2Options.length === 0;
};

const isReadOnlySub2 = (upsellConstraint: string, constraintType: string, constraintSub: string): boolean => {
  if (!upsellConstraint || !constraintType || !constraintSub || !upsellConstraintMapping[upsellConstraint] || !upsellConstraintMapping[upsellConstraint][constraintType] || !upsellConstraintMapping[upsellConstraint][constraintType][constraintSub]) return false;
  const sub2Options = upsellConstraintMapping[upsellConstraint][constraintType][constraintSub];
  // If array only contains "-", it should be read-only
  return sub2Options.length === 1 && sub2Options[0] === "-";
};

// Data structure for LoB -> Use Case -> Sub Use Case mapping
const lobUseCaseMapping: Record<string, Record<string, string[]>> = {
  "Diligence & Audit": {
    "Mystery Audit": ["-"],
    "Non-Mystery Audit": ["Stock Audit", "Store Audit", "Warehouse Audit", "Retail Outlet Audit", "Distributor Audit", "Others"],
    "Background Verification": ["-"],
  },
  "New Business Development": {
    "Promoters Deployment": ["-"],
    "Fixed Resource Deployment": ["-"],
    "New Customer Acquisition": ["-"],
    "Retailer Activation": ["-"],
    "Society Activation": ["-"],
  },
  "Digital Gigs": {
    "Content Operations": ["-"],
    "Telecalling": ["-"],
  },
  "Awign Expert": {
    "-": ["-"],
  },
  "Last Mile Operations": {
    "-": ["-"],
  },
  "Invigilation & Proctoring": {
    "-": ["-"],
  },
  "Staffing": {
    "-": ["-"],
  },
  "Others": {
    "Market Survey": ["-"],
    "Edtech": ["-"],
    "SaaS": ["-"],
    "Others": ["-"],
  },
};

// Helper functions to get use cases and sub use cases
const getUseCasesForLob = (lob: string): string[] => {
  if (!lob || !lobUseCaseMapping[lob]) return [];
  // Filter out "-" option as it should not be selectable
  return Object.keys(lobUseCaseMapping[lob]).filter(uc => uc !== "-");
};

const getSubUseCasesForUseCase = (lob: string, useCase: string): string[] => {
  if (!lob || !useCase || !lobUseCaseMapping[lob] || !lobUseCaseMapping[lob][useCase]) return [];
  // Filter out "-" option as it should not be selectable
  return lobUseCaseMapping[lob][useCase].filter(subUc => subUc !== "-");
};

// Check if LoB only has "-" as use case (should disable use case field)
const hasOnlyDashUseCase = (lob: string): boolean => {
  if (!lob || !lobUseCaseMapping[lob]) return false;
  const useCases = Object.keys(lobUseCaseMapping[lob]);
  return useCases.length === 1 && useCases[0] === "-";
};

// Check if Use Case only has "-" as sub use case (should disable sub use case field)
const hasOnlyDashSubUseCase = (lob: string, useCase: string): boolean => {
  if (!lob || !useCase || !lobUseCaseMapping[lob] || !lobUseCaseMapping[lob][useCase]) return false;
  const subUseCases = lobUseCaseMapping[lob][useCase];
  return subUseCases.length === 1 && subUseCases[0] === "-";
};

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

// Helper function to get Financial Year based on current date (for initial auto-fill)
const getFinancialYear = (): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12 (Jan = 1, Dec = 12)
  return calculateFinancialYear(currentMonth, currentYear);
};

// Helper function to extract the starting year from financial year string (e.g., "2025-26" -> 2025)
const extractYearFromFinancialYear = (financialYear: string): number => {
  const match = financialYear.match(/^(\d{4})-/);
  return match ? parseInt(match[1], 10) : new Date().getFullYear();
};

export default function Mandates() {
  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [kams, setKams] = useState<{ id: string; full_name: string }[]>([]);
  const [formData, setFormData] = useState<MandateFormData>({
    projectCode: "",
    projectName: "",
    accountId: "",
    kamId: "",
    lob: "",
    useCase: "",
    subUseCase: "",
    type: "",
    newSalesOwner: "",
    handoverMonthlyVolume: "",
    handoverCommercialPerHead: "",
    handoverMcv: "",
    prjDurationMonths: "",
    handoverAcv: "",
    handoverPrjType: "",
    revenueMonthlyVolume: "",
    revenueCommercialPerHead: "",
    revenueMcv: "",
    revenueAcv: "",
    revenuePrjType: "",
    mandateHealth: "",
    upsellConstraint: "",
    upsellConstraintType: "",
    upsellConstraintSub: "",
    upsellConstraintSub2: "",
    clientBudgetTrend: "",
    awignSharePercent: "",
    retentionType: "",
    upsellActionStatus: "",
  });

  // Filters for view mode
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterKam, setFilterKam] = useState("all");
  const [filterLob, setFilterLob] = useState("all");
  const [filterMandateHealth, setFilterMandateHealth] = useState("all");
  const [filterUpsellStatus, setFilterUpsellStatus] = useState("all");
  const [filterRetentionType, setFilterRetentionType] = useState("all");

  // Search terms for dropdowns in forms
  const [accountSearch, setAccountSearch] = useState("");
  const [kamSearch, setKamSearch] = useState("");
  const [editAccountSearch, setEditAccountSearch] = useState("");
  const [editKamSearch, setEditKamSearch] = useState("");
  const [mandates, setMandates] = useState<any[]>([]);
  const [loadingMandates, setLoadingMandates] = useState(false);
  const [availableLobs, setAvailableLobs] = useState<string[]>([]);
  const [availableRetentionTypes, setAvailableRetentionTypes] = useState<string[]>([]);
  const [selectedMandate, setSelectedMandate] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editMandateData, setEditMandateData] = useState<any>(null);
  const [updatingMandate, setUpdatingMandate] = useState(false);
  const [isMandateCheckerEditMode, setIsMandateCheckerEditMode] = useState(false);
  const [updatingMandateChecker, setUpdatingMandateChecker] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mandateToDelete, setMandateToDelete] = useState<any | null>(null);
  const [deletingMandate, setDeletingMandate] = useState(false);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<{ rowNumber: number; data: Record<string, any>; isValid: boolean; errors: string[] }>>([]);
  const [csvFileToUpload, setCsvFileToUpload] = useState<File | null>(null);
  const [updateOptionsDialogOpen, setUpdateOptionsDialogOpen] = useState(false);
  const [mandateForUpdate, setMandateForUpdate] = useState<any | null>(null);
  const [monthlyRecordDialogOpen, setMonthlyRecordDialogOpen] = useState(false);
  const [monthlyRecordForm, setMonthlyRecordForm] = useState({
    month: "",
    year: "",
    financialYear: "",
    achievedMcv: "",
  });
  const [savingMonthlyRecord, setSavingMonthlyRecord] = useState(false);
  const [bulkUpdateMcvDialogOpen, setBulkUpdateMcvDialogOpen] = useState(false);
  const [bulkUploadCasesDialogOpen, setBulkUploadCasesDialogOpen] = useState(false);
  const [mcvCsvPreviewOpen, setMcvCsvPreviewOpen] = useState(false);
  const [mcvCsvPreviewRows, setMcvCsvPreviewRows] = useState<Array<{ rowNumber: number; data: Record<string, any>; isValid: boolean; errors: string[] }>>([]);
  const [mcvCsvFileToUpload, setMcvCsvFileToUpload] = useState<File | null>(null);

  const { toast } = useToast();

  // Fetch accounts and KAMs
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from("accounts")
          .select("id, name")
          .order("name");

        if (accountsData && !accountsError) {
          setAccounts(accountsData);
        } else {
          // If accounts table doesn't exist or error, set empty array
          setAccounts([]);
          if (accountsError) {
            console.warn("Accounts table may not exist:", accountsError.message);
          }
        }

        // Fetch KAMs (users with kam role)
        const { data: kamData, error: kamError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "kam")
          .order("full_name");

        if (kamData && !kamError) {
          setKams(kamData);
        } else {
          // If no KAMs found or error, set empty array
          setKams([]);
          if (kamError) {
            console.warn("Error fetching KAMs:", kamError.message);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Auto-calculate MCV when monthly volume or commercial per head changes
  useEffect(() => {
    const monthlyVolume = parseFloat(formData.handoverMonthlyVolume) || 0;
    const commercialPerHead = parseFloat(formData.handoverCommercialPerHead) || 0;
    const mcv = monthlyVolume * commercialPerHead;
    if (monthlyVolume > 0 && commercialPerHead > 0) {
      setFormData((prev) => ({
        ...prev,
        handoverMcv: mcv.toString(),
      }));
    }
  }, [formData.handoverMonthlyVolume, formData.handoverCommercialPerHead]);

  useEffect(() => {
    const monthlyVolume = parseFloat(formData.revenueMonthlyVolume) || 0;
    const commercialPerHead = parseFloat(formData.revenueCommercialPerHead) || 0;
    const mcv = monthlyVolume * commercialPerHead;
    if (monthlyVolume > 0 && commercialPerHead > 0) {
      setFormData((prev) => ({
        ...prev,
        revenueMcv: mcv.toString(),
      }));
    }
  }, [formData.revenueMonthlyVolume, formData.revenueCommercialPerHead]);

  // Reset dependent fields when Mandate Health changes
  useEffect(() => {
    if (formData.mandateHealth === "Need Improvement") {
      // If health is "Need Improvement", reset all dependent fields
      setFormData((prev) => ({
        ...prev,
        upsellConstraint: "",
        upsellConstraintType: "-",
        upsellConstraintSub: "-",
        upsellConstraintSub2: "-",
        clientBudgetTrend: "",
        awignSharePercent: "",
      }));
    }
    // Note: When health changes between "Exceeds" and "Meets", we don't reset
    // because both allow the same upsell constraint values
  }, [formData.mandateHealth]);

  // Reset upsell constraint fields and retention-related fields when parent changes
  useEffect(() => {
    if (formData.upsellConstraint === "NO") {
      setFormData((prev) => ({
        ...prev,
        upsellConstraintType: "-",
        upsellConstraintSub: "-",
        upsellConstraintSub2: "-",
        // Reset client budget trend and awign share when constraint changes to NO
        // This forces user to reselect them based on new constraint value
        clientBudgetTrend: "",
        awignSharePercent: "",
      }));
    } else if (formData.upsellConstraint === "YES") {
      // Reset sub fields when constraint changes to YES
      setFormData((prev) => ({
        ...prev,
        upsellConstraintType: "",
        upsellConstraintSub: "",
        upsellConstraintSub2: "",
        // Reset client budget trend and awign share when constraint changes to YES
        // Since YES means retention type is "E", these fields are not needed
        clientBudgetTrend: "",
        awignSharePercent: "",
      }));
    }
  }, [formData.upsellConstraint]);

  useEffect(() => {
    if (formData.upsellConstraint === "YES" && formData.upsellConstraintType) {
      // When constraint type changes, always reset sub and sub2 to ensure valid hierarchy
      const validSubs = getUpsellConstraintSubs(formData.upsellConstraint, formData.upsellConstraintType);
      if (formData.upsellConstraintSub && !validSubs.includes(formData.upsellConstraintSub)) {
        // Reset if current sub is invalid for new type
        setFormData((prev) => ({
          ...prev,
          upsellConstraintSub: "",
          upsellConstraintSub2: "",
        }));
      } else {
        // Even if sub is valid, reset it to force user to reselect based on new type
        // This ensures proper hierarchy validation
        setFormData((prev) => ({
          ...prev,
          upsellConstraintSub: "",
          upsellConstraintSub2: "",
        }));
      }
    } else if (formData.upsellConstraint === "YES" && !formData.upsellConstraintType) {
      // If type is cleared, reset sub fields
      setFormData((prev) => ({
        ...prev,
        upsellConstraintSub: "",
        upsellConstraintSub2: "",
      }));
    }
  }, [formData.upsellConstraintType]);

  useEffect(() => {
    if (formData.upsellConstraint === "YES" && formData.upsellConstraintType && formData.upsellConstraintSub) {
      // When constraint sub changes, always reset sub2 to ensure valid hierarchy
      const validSub2s = getUpsellConstraintSub2s(formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub);
      if (formData.upsellConstraintSub2 && validSub2s.length > 0 && !validSub2s.includes(formData.upsellConstraintSub2)) {
        // Reset if current sub2 is invalid for new sub
        setFormData((prev) => ({
          ...prev,
          upsellConstraintSub2: "",
        }));
      } else {
        // Even if sub2 is valid, reset it to force user to reselect based on new sub
        // This ensures proper hierarchy validation
        setFormData((prev) => ({
          ...prev,
          upsellConstraintSub2: "",
        }));
      }
    } else if (formData.upsellConstraint === "YES" && formData.upsellConstraintType && !formData.upsellConstraintSub) {
      // If sub is cleared, reset sub2
      setFormData((prev) => ({
        ...prev,
        upsellConstraintSub2: "",
      }));
    }
  }, [formData.upsellConstraintSub]);

  // Clear Sub2 if it's "-" when field becomes free text input
  useEffect(() => {
    if (formData.upsellConstraint === "YES" && formData.upsellConstraintType && formData.upsellConstraintSub) {
      if (isFreeTextSub2(formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub) && formData.upsellConstraintSub2 === "-") {
        setFormData((prev) => ({
          ...prev,
          upsellConstraintSub2: "",
        }));
      }
    }
  }, [formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub, formData.upsellConstraintSub2]);

  // Reset Use Case and Sub Use Case when LoB changes
  useEffect(() => {
    if (formData.lob) {
      // If LoB only has "-" as use case, set it automatically
      if (hasOnlyDashUseCase(formData.lob)) {
        setFormData((prev) => ({
          ...prev,
          useCase: "-",
          subUseCase: "-",
        }));
      } else {
        const validUseCases = getUseCasesForLob(formData.lob);
        // Only reset if current useCase is not valid for the new LoB
        if (formData.useCase && !validUseCases.includes(formData.useCase)) {
          setFormData((prev) => ({
            ...prev,
            useCase: "",
            subUseCase: "",
          }));
        } else if (formData.useCase) {
          // If useCase is still valid, check subUseCase
          const validSubUseCases = getSubUseCasesForUseCase(formData.lob, formData.useCase);
          if (formData.subUseCase && !validSubUseCases.includes(formData.subUseCase)) {
            setFormData((prev) => ({
              ...prev,
              subUseCase: "",
            }));
          }
        }
      }
    }
  }, [formData.lob]);

  // Reset Sub Use Case when Use Case changes
  useEffect(() => {
    if (formData.lob && formData.useCase) {
      // If Use Case only has "-" as sub use case, set it automatically
      if (hasOnlyDashSubUseCase(formData.lob, formData.useCase)) {
        setFormData((prev) => ({
          ...prev,
          subUseCase: "-",
        }));
      } else {
        const validSubUseCases = getSubUseCasesForUseCase(formData.lob, formData.useCase);
        // Only reset if current subUseCase is not valid for the new useCase
        if (formData.subUseCase && !validSubUseCases.includes(formData.subUseCase)) {
          setFormData((prev) => ({
            ...prev,
            subUseCase: "",
          }));
        }
      }
    }
  }, [formData.useCase]);

  // Auto-calculate Retention Type based on decision tree logic
  useEffect(() => {
    const calculateRetentionType = (): string => {
      // Level 1: Check Mandate Health Distribution
      if (formData.mandateHealth === "Need Improvement") {
        return "NI";
      }

      // Level 2: Check Upsell Constraint (only if Mandate Health is "Exceeds/Meets")
      if (formData.mandateHealth === "Exceeds Expectations" || formData.mandateHealth === "Meets Expectations") {
        if (formData.upsellConstraint === "YES") {
          return "E";
        }

        // Level 3: Check Current PRJ Status / Client's Budget Trends (only if Upsell Constraint = "NO")
        if (formData.upsellConstraint === "NO" && formData.clientBudgetTrend && formData.awignSharePercent) {
          const isAwignShare70Plus = formData.awignSharePercent === "70% & Above";
          const isAwignShareBelow70 = formData.awignSharePercent === "Below 70%";

          // Current PRJ Status = "Increase"
          if (formData.clientBudgetTrend === "Increase") {
            if (isAwignShare70Plus) return "A";
            if (isAwignShareBelow70) return "B";
          }

          // Current PRJ Status = "Same"
          if (formData.clientBudgetTrend === "Same") {
            if (isAwignShare70Plus) return "Star";
            if (isAwignShareBelow70) return "C";
          }

          // Client's Budget Trends = "Decrease"
          if (formData.clientBudgetTrend === "Decrease") {
            // Both cases result in D according to the matrix
            return "D";
          }
        }
      }

      return "";
    };

    const retentionType = calculateRetentionType();
    if (retentionType !== formData.retentionType) {
      setFormData((prev) => ({
        ...prev,
        retentionType,
      }));
    }
  }, [
    formData.mandateHealth,
    formData.upsellConstraint,
    formData.clientBudgetTrend,
    formData.awignSharePercent,
  ]);

  // Auto-calculate MCV for edit mode
  useEffect(() => {
    if (editMandateData) {
      const monthlyVolume = parseFloat(editMandateData.handoverMonthlyVolume) || 0;
      const commercialPerHead = parseFloat(editMandateData.handoverCommercialPerHead) || 0;
      const mcv = monthlyVolume * commercialPerHead;
      if (monthlyVolume > 0 && commercialPerHead > 0) {
        setEditMandateData((prev: any) => ({
          ...prev,
          handoverMcv: mcv.toString(),
        }));
      }
    }
  }, [editMandateData?.handoverMonthlyVolume, editMandateData?.handoverCommercialPerHead]);

  useEffect(() => {
    if (editMandateData) {
      const monthlyVolume = parseFloat(editMandateData.revenueMonthlyVolume) || 0;
      const commercialPerHead = parseFloat(editMandateData.revenueCommercialPerHead) || 0;
      const mcv = monthlyVolume * commercialPerHead;
      if (monthlyVolume > 0 && commercialPerHead > 0) {
        setEditMandateData((prev: any) => ({
          ...prev,
          revenueMcv: mcv.toString(),
        }));
      }
    }
  }, [editMandateData?.revenueMonthlyVolume, editMandateData?.revenueCommercialPerHead]);

  // Calculate Financial Year when month or year changes
  useEffect(() => {
    if (monthlyRecordForm.month && monthlyRecordForm.year) {
      const month = parseInt(monthlyRecordForm.month);
      const year = parseInt(monthlyRecordForm.year);
      if (!isNaN(month) && !isNaN(year)) {
        const financialYear = calculateFinancialYear(month, year);
        setMonthlyRecordForm(prev => ({
          ...prev,
          financialYear: financialYear,
        }));
      }
    } else {
      setMonthlyRecordForm(prev => ({
        ...prev,
        financialYear: "",
      }));
    }
  }, [monthlyRecordForm.month, monthlyRecordForm.year]);

  // Check for existing monthly record when month/year changes
  useEffect(() => {
    if (monthlyRecordForm.month && monthlyRecordForm.year && mandateForUpdate) {
      const month = parseInt(monthlyRecordForm.month);
      const year = parseInt(monthlyRecordForm.year);
      if (!isNaN(month) && !isNaN(year)) {
        const monthYear = `${year}-${String(month).padStart(2, '0')}`;
        
        // Check if mandate has monthly_data and if record exists for this month/year
        const monthlyData = mandateForUpdate.monthly_data;
        if (monthlyData && typeof monthlyData === 'object' && !Array.isArray(monthlyData)) {
          const existingRecord = monthlyData[monthYear];
          if (existingRecord !== undefined && existingRecord !== null) {
            // Record exists - handle both old format (array) and new format (number)
            let achievedMcv = 0;
            if (Array.isArray(existingRecord) && existingRecord.length >= 2) {
              // Old format: [plannedMcv, achievedMcv]
              achievedMcv = parseFloat(existingRecord[1]?.toString() || "0") || 0;
            } else if (typeof existingRecord === 'number') {
              // New format: just achievedMcv
              achievedMcv = existingRecord;
            }
            
            setMonthlyRecordForm(prev => ({
              ...prev,
              achievedMcv: achievedMcv > 0 ? achievedMcv.toString() : "",
            }));
          } else {
            // No record exists for this month/year, clear the fields
            setMonthlyRecordForm(prev => ({
              ...prev,
              achievedMcv: "",
            }));
          }
        } else {
          // No monthly_data exists, clear fields
          setMonthlyRecordForm(prev => ({
            ...prev,
            achievedMcv: "",
          }));
        }
      }
    } else if (!monthlyRecordForm.month || !monthlyRecordForm.year) {
      // If month or year is cleared, clear the MCV fields
      setMonthlyRecordForm(prev => ({
        ...prev,
        achievedMcv: "",
      }));
    }
  }, [monthlyRecordForm.month, monthlyRecordForm.year, mandateForUpdate]);

  // Reset dependent fields when Mandate Health changes in edit mode
  useEffect(() => {
    if (editMandateData) {
      if (editMandateData.mandateHealth === "Need Improvement") {
        // If health is "Need Improvement", reset all dependent fields
        setEditMandateData((prev: any) => ({
          ...prev,
          upsellConstraint: "",
          upsellConstraintType: "-",
          upsellConstraintSub: "-",
          upsellConstraintSub2: "-",
          clientBudgetTrend: "",
          awignSharePercent: "",
        }));
      }
      // Note: When health changes between "Exceeds" and "Meets", we don't reset
      // because both allow the same upsell constraint values
    }
  }, [editMandateData?.mandateHealth]);

  // Reset upsell constraint fields and retention-related fields for edit mode when parent changes
  useEffect(() => {
    if (editMandateData) {
      if (editMandateData.upsellConstraint === "NO") {
        setEditMandateData((prev: any) => ({
          ...prev,
          upsellConstraintType: "-",
          upsellConstraintSub: "-",
          upsellConstraintSub2: "-",
          // Reset client budget trend and awign share when constraint changes to NO
          clientBudgetTrend: "",
          awignSharePercent: "",
        }));
      } else if (editMandateData.upsellConstraint === "YES") {
        // Reset sub fields when constraint changes to YES
        setEditMandateData((prev: any) => ({
          ...prev,
          upsellConstraintType: "",
          upsellConstraintSub: "",
          upsellConstraintSub2: "",
          // Reset client budget trend and awign share when constraint changes to YES
          clientBudgetTrend: "",
          awignSharePercent: "",
        }));
      }
    }
  }, [editMandateData?.upsellConstraint]);

  useEffect(() => {
    if (editMandateData && editMandateData.upsellConstraint === "YES" && editMandateData.upsellConstraintType) {
      // When constraint type changes, always reset sub and sub2 to ensure valid hierarchy
      const validSubs = getUpsellConstraintSubs(editMandateData.upsellConstraint, editMandateData.upsellConstraintType);
      if (editMandateData.upsellConstraintSub && !validSubs.includes(editMandateData.upsellConstraintSub)) {
        // Reset if current sub is invalid for new type
        setEditMandateData((prev: any) => ({
          ...prev,
          upsellConstraintSub: "",
          upsellConstraintSub2: "",
        }));
      } else {
        // Even if sub is valid, reset it to force user to reselect based on new type
        setEditMandateData((prev: any) => ({
          ...prev,
          upsellConstraintSub: "",
          upsellConstraintSub2: "",
        }));
      }
    } else if (editMandateData && editMandateData.upsellConstraint === "YES" && !editMandateData.upsellConstraintType) {
      // If type is cleared, reset sub fields
      setEditMandateData((prev: any) => ({
        ...prev,
        upsellConstraintSub: "",
        upsellConstraintSub2: "",
      }));
    }
  }, [editMandateData?.upsellConstraintType]);

  useEffect(() => {
    if (editMandateData && editMandateData.upsellConstraint === "YES" && editMandateData.upsellConstraintType && editMandateData.upsellConstraintSub) {
      // When constraint sub changes, always reset sub2 to ensure valid hierarchy
      const validSub2s = getUpsellConstraintSub2s(editMandateData.upsellConstraint, editMandateData.upsellConstraintType, editMandateData.upsellConstraintSub);
      if (editMandateData.upsellConstraintSub2 && validSub2s.length > 0 && !validSub2s.includes(editMandateData.upsellConstraintSub2)) {
        // Reset if current sub2 is invalid for new sub
        setEditMandateData((prev: any) => ({
          ...prev,
          upsellConstraintSub2: "",
        }));
      } else {
        // Even if sub2 is valid, reset it to force user to reselect based on new sub
        setEditMandateData((prev: any) => ({
          ...prev,
          upsellConstraintSub2: "",
        }));
      }
    } else if (editMandateData && editMandateData.upsellConstraint === "YES" && editMandateData.upsellConstraintType && !editMandateData.upsellConstraintSub) {
      // If sub is cleared, reset sub2
      setEditMandateData((prev: any) => ({
        ...prev,
        upsellConstraintSub2: "",
      }));
    }
  }, [editMandateData?.upsellConstraintSub]);

  // Auto-calculate Retention Type for edit mode
  useEffect(() => {
    if (editMandateData) {
      const calculateRetentionType = (): string => {
        // Level 1: Check Mandate Health Distribution
        if (editMandateData.mandateHealth === "Need Improvement") {
          return "NI";
        }

        // Level 2: Check Upsell Constraint (only if Mandate Health is "Exceeds/Meets")
        if (editMandateData.mandateHealth === "Exceeds Expectations" || editMandateData.mandateHealth === "Meets Expectations") {
          if (editMandateData.upsellConstraint === "YES") {
            return "E";
          }

          // Level 3: Check Current PRJ Status / Client's Budget Trends (only if Upsell Constraint = "NO")
          if (editMandateData.upsellConstraint === "NO" && editMandateData.clientBudgetTrend && editMandateData.awignSharePercent) {
            const isAwignShare70Plus = editMandateData.awignSharePercent === "70% & Above";
            const isAwignShareBelow70 = editMandateData.awignSharePercent === "Below 70%";

            // Current PRJ Status = "Increase"
            if (editMandateData.clientBudgetTrend === "Increase") {
              if (isAwignShare70Plus) return "A";
              if (isAwignShareBelow70) return "B";
            }

            // Current PRJ Status = "Same"
            if (editMandateData.clientBudgetTrend === "Same") {
              if (isAwignShare70Plus) return "Star";
              if (isAwignShareBelow70) return "C";
            }

            // Client's Budget Trends = "Decrease"
            if (editMandateData.clientBudgetTrend === "Decrease") {
              // Both cases result in D according to the matrix
              return "D";
            }
          }
        }

        return "";
      };

      const retentionType = calculateRetentionType();
      if (retentionType !== editMandateData.retentionType) {
        setEditMandateData((prev: any) => ({
          ...prev,
          retentionType,
        }));
      }
    }
  }, [
    editMandateData?.mandateHealth,
    editMandateData?.upsellConstraint,
    editMandateData?.clientBudgetTrend,
    editMandateData?.awignSharePercent,
  ]);

  // Reset Use Case and Sub Use Case when LoB changes in edit form
  useEffect(() => {
    if (editMandateData?.lob) {
      // If LoB only has "-" as use case, set it automatically
      if (hasOnlyDashUseCase(editMandateData.lob)) {
        setEditMandateData((prev: any) => ({
          ...prev,
          useCase: "-",
          subUseCase: "-",
        }));
      } else {
        const validUseCases = getUseCasesForLob(editMandateData.lob);
        // Only reset if current useCase is not valid for the new LoB
        if (editMandateData.useCase && !validUseCases.includes(editMandateData.useCase)) {
          setEditMandateData((prev: any) => ({
            ...prev,
            useCase: "",
            subUseCase: "",
          }));
        } else if (editMandateData.useCase) {
          // If useCase is still valid, check subUseCase
          const validSubUseCases = getSubUseCasesForUseCase(editMandateData.lob, editMandateData.useCase);
          if (editMandateData.subUseCase && !validSubUseCases.includes(editMandateData.subUseCase)) {
            setEditMandateData((prev: any) => ({
              ...prev,
              subUseCase: "",
            }));
          }
        }
      }
    }
  }, [editMandateData?.lob]);

  // Reset Sub Use Case when Use Case changes in edit form
  useEffect(() => {
    if (editMandateData?.lob && editMandateData?.useCase) {
      // If Use Case only has "-" as sub use case, set it automatically
      if (hasOnlyDashSubUseCase(editMandateData.lob, editMandateData.useCase)) {
        setEditMandateData((prev: any) => ({
          ...prev,
          subUseCase: "-",
        }));
      } else {
        const validSubUseCases = getSubUseCasesForUseCase(editMandateData.lob, editMandateData.useCase);
        // Only reset if current subUseCase is not valid for the new useCase
        if (editMandateData.subUseCase && !validSubUseCases.includes(editMandateData.subUseCase)) {
          setEditMandateData((prev: any) => ({
            ...prev,
            subUseCase: "",
          }));
        }
      }
    }
  }, [editMandateData?.useCase]);

  const handleInputChange = (field: keyof MandateFormData, value: string) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };
      
      // If type is changed to "New Cross Sell", clear all handover values
      if (field === "type" && value === "New Cross Sell") {
        updated.newSalesOwner = "";
        updated.handoverMonthlyVolume = "";
        updated.handoverCommercialPerHead = "";
        updated.handoverMcv = "";
        updated.prjDurationMonths = "";
        updated.handoverAcv = "";
        updated.handoverPrjType = "";
      }
      
      return updated;
    });
  };

  // Helper function to convert "-" to null
  const sanitizeValue = (value: string | null | undefined): string | null => {
    if (!value || value.trim() === "" || value === "-") return null;
    return value;
  };

  // Helper function to ensure enum values match exactly
  const ensureEnumValue = (value: string | null | undefined, enumValues: string[]): string | null => {
    if (!value || value === "-") return null;
    // Check if value matches any enum value (case-sensitive)
    const matched = enumValues.find(ev => ev === value);
    return matched || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("You must be logged in to create a mandate");
      }

      // Prepare data for insertion
      const mandateData = {
        // Project Info
        project_code: formData.projectCode,
        project_name: formData.projectName,
        account_id: sanitizeValue(formData.accountId),
        kam_id: sanitizeValue(formData.kamId),
        lob: ensureEnumValue(formData.lob, [
          'Diligence & Audit',
          'New Business Development',
          'Digital Gigs',
          'Awign Expert',
          'Last Mile Operations',
          'Invigilation & Proctoring',
          'Staffing',
          'Others'
        ]) || formData.lob, // Fallback to original if not in enum (shouldn't happen)
        use_case: ensureEnumValue(formData.useCase, [
          'Mystery Audit',
          'Non-Mystery Audit',
          'Background Verification',
          'Promoters Deployment',
          'Fixed Resource Deployment',
          'New Customer Acquisition',
          'Retailer Activation',
          'Society Activation',
          'Content Operations',
          'Telecalling',
          'Market Survey',
          'Edtech',
          'SaaS',
          'Others'
        ]),
        sub_use_case: ensureEnumValue(formData.subUseCase, [
          'Stock Audit',
          'Store Audit',
          'Warehouse Audit',
          'Retail Outlet Audit',
          'Distributor Audit',
          'Others'
        ]),
        type: ensureEnumValue(formData.type, [
          'New Acquisition',
          'New Cross Sell',
          'Existing'
        ]),
        
        // Handover Info - Set to null if type is "New Cross Sell"
        new_sales_owner: formData.type === "New Cross Sell" ? null : (formData.newSalesOwner || null),
        handover_monthly_volume: formData.type === "New Cross Sell" ? null : (formData.handoverMonthlyVolume ? parseFloat(formData.handoverMonthlyVolume) : null),
        handover_commercial_per_head: formData.type === "New Cross Sell" ? null : (formData.handoverCommercialPerHead ? parseFloat(formData.handoverCommercialPerHead) : null),
        handover_mcv: formData.type === "New Cross Sell" ? null : (formData.handoverMcv ? parseFloat(formData.handoverMcv) : null),
        prj_duration_months: formData.type === "New Cross Sell" ? null : (formData.prjDurationMonths ? parseInt(formData.prjDurationMonths) : null),
        handover_acv: formData.type === "New Cross Sell" ? null : (formData.handoverAcv ? parseFloat(formData.handoverAcv) : null),
        handover_prj_type: formData.type === "New Cross Sell" ? null : ensureEnumValue(formData.handoverPrjType, ['Recurring', 'One-time']),
        
        // Revenue Info
        revenue_monthly_volume: formData.revenueMonthlyVolume ? parseFloat(formData.revenueMonthlyVolume) : null,
        revenue_commercial_per_head: formData.revenueCommercialPerHead ? parseFloat(formData.revenueCommercialPerHead) : null,
        revenue_mcv: formData.revenueMcv ? parseFloat(formData.revenueMcv) : null,
        revenue_acv: formData.revenueAcv ? parseFloat(formData.revenueAcv) : null,
        revenue_prj_type: ensureEnumValue(formData.revenuePrjType, ['Recurring', 'One-time']),
        
        // Mandate Checker
        mandate_health: ensureEnumValue(formData.mandateHealth, [
          'Exceeds Expectations',
          'Meets Expectations',
          'Need Improvement'
        ]),
        upsell_constraint: ensureEnumValue(formData.upsellConstraint, ['YES', 'NO']),
        upsell_constraint_type: ensureEnumValue(formData.upsellConstraintType, ['Internal', 'External']),
        upsell_constraint_sub: ensureEnumValue(formData.upsellConstraintSub, [
          'Profitability',
          'Delivery',
          'Others',
          'Not enough demand',
          'Collection Issue'
        ]),
        upsell_constraint_sub2: sanitizeValue(formData.upsellConstraintSub2), // Can be free text, so just sanitize
        client_budget_trend: ensureEnumValue(formData.clientBudgetTrend, ['Increase', 'Same', 'Decrease']),
        awign_share_percent: ensureEnumValue(formData.awignSharePercent, ['Below 70%', '70% & Above']),
        retention_type: ensureEnumValue(formData.retentionType, ['STAR', 'A', 'B', 'C', 'D', 'E', 'NI']),
        
        // Upsell Action Status
        upsell_action_status: ensureEnumValue(formData.upsellActionStatus, ['Not Started', 'Ongoing', 'Done']),
        
        // Metadata
        created_by: user.id,
      };

      const { error: insertError } = await supabase
        .from("mandates")
        .insert([mandateData]);

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Success!",
        description: "Mandate saved successfully.",
      });

      // Reset form
      setFormData({
        projectCode: "",
        projectName: "",
        accountId: "",
        kamId: "",
        lob: "",
        useCase: "",
        subUseCase: "",
        newSalesOwner: "",
        handoverMonthlyVolume: "",
        handoverCommercialPerHead: "",
        handoverMcv: "",
        prjDurationMonths: "",
        handoverAcv: "",
        handoverPrjType: "",
        revenueMonthlyVolume: "",
        revenueCommercialPerHead: "",
        revenueMcv: "",
        revenueAcv: "",
        revenuePrjType: "",
        mandateHealth: "",
        upsellConstraint: "",
        upsellConstraintType: "",
        upsellConstraintSub: "",
        upsellConstraintSub2: "",
        clientBudgetTrend: "",
        awignSharePercent: "",
        retentionType: "",
        upsellActionStatus: "",
      });

      // Close dialog and refresh mandates list
      setFormDialogOpen(false);
      fetchMandates();
    } catch (error: any) {
      console.error("Error saving mandate:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save mandate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch mandates from database
  const handleDownloadMandateTemplate = () => {
    // Helper function to escape CSV values
    const escapeCSVValue = (value: any): string => {
      if (value === null || value === undefined) {
        return "";
      }
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const templateHeaders = [
      { key: "project_id", label: "Project Code" },
      { key: "account_name", label: "Account Name" },
      { key: "kam_name", label: "KAM Name" },
      { key: "project_name", label: "Project Name" },
      { key: "lob", label: "LoB (Vertical)" },
      { key: "type", label: "Type" },
      { key: "new_sales_owner", label: "New Sales Owner" },
      { key: "handover_monthly_volume", label: "Handover Monthly Volume" },
      { key: "handover_commercial_per_head", label: "Handover Commercial per head/task" },
      { key: "prj_duration_months", label: "PRJ duration in months" },
      { key: "handover_acv", label: "Handover ACV" },
      { key: "handover_prj_type", label: "Handover PRJ Type" },
      { key: "revenue_monthly_volume", label: "Revenue Monthly Volume" },
      { key: "revenue_commercial_per_head", label: "Revenue Commercial per head/task" },
      { key: "revenue_acv", label: "Revenue ACV" },
      { key: "revenue_prj_type", label: "Revenue PRJ Type" },
      { key: "mandate_health", label: "Mandate Health" },
      { key: "upsell_constraint", label: "Upsell Constraint" },
      { key: "upsell_constraint_type", label: "Upsell Constraint Type" },
      { key: "upsell_constraint_sub", label: "Upsell Constraint Type - Sub" },
      { key: "upsell_constraint_sub2", label: "Upsell Constraint Type - Sub 2" },
      { key: "client_budget_trend", label: "Client Budget Trend" },
      { key: "awign_share_percent", label: "Awign Share %" },
      { key: "upsell_action_status", label: "Upsell Action Status" },
      { key: "gap1", label: "" },
      { key: "gap2", label: "" },
      { key: "reference_lob", label: "LoB" },
      { key: "reference_use_case", label: "Use Case" },
      { key: "reference_sub_use_case", label: "Sub Use Case" },
      { key: "reference_type", label: "Type" },
      { key: "reference_prj_type", label: "PRJ Type" },
      { key: "reference_mandate_health", label: "Mandate Health" },
      { key: "reference_client_budget_trend", label: "Client Budget Trend" },
      { key: "reference_upsell_constraint", label: "Upsell Constraint" },
      { key: "reference_upsell_constraint_type", label: "Upsell Constraint Type" },
      { key: "reference_upsell_constraint_sub", label: "Upsell Constraint Sub" },
      { key: "reference_upsell_constraint_sub2", label: "Upsell Constraint Sub2" },
      { key: "reference_upsell_action_status", label: "Upsell Action Status" },
    ];
    
    // Create header row
    const headerRow = templateHeaders.map((h) => escapeCSVValue(h.label)).join(",");
    
    // Create reference data rows
    const referenceRows: string[] = [];
    
    // Add empty row for spacing
    referenceRows.push(templateHeaders.map(() => "").join(","));
    
    // Generate all valid LoB → Use Case → Sub Use Case combinations
    const lobCombinations: Array<{ lob: string; useCase: string; subUseCase: string }> = [];
    Object.entries(lobUseCaseMapping).forEach(([lob, useCases]) => {
      Object.entries(useCases).forEach(([useCase, subUseCases]) => {
        subUseCases.forEach((subUseCase) => {
          lobCombinations.push({
            lob,
            useCase: useCase === "-" ? "N/A" : useCase,
            subUseCase: subUseCase === "-" ? "N/A" : subUseCase,
          });
        });
      });
    });
    
    // Generate all valid Upsell Constraint combinations
    const upsellCombinations: Array<{ constraint: string; type: string; sub: string; sub2: string }> = [];
    Object.entries(upsellConstraintMapping).forEach(([constraint, types]) => {
      Object.entries(types).forEach(([type, subs]) => {
        Object.entries(subs).forEach(([sub, sub2s]) => {
          if (sub2s.length === 0) {
            // Free text input
            upsellCombinations.push({
              constraint,
              type: type === "-" ? "N/A" : type,
              sub: sub === "-" ? "N/A" : sub,
              sub2: "Free text",
            });
          } else {
            sub2s.forEach((sub2) => {
              if (sub2 !== "-") {
                upsellCombinations.push({
                  constraint,
                  type: type === "-" ? "N/A" : type,
                  sub: sub === "-" ? "N/A" : sub,
                  sub2: sub2 === "-" ? "N/A" : sub2,
                });
              } else {
                upsellCombinations.push({
                  constraint,
                  type: type === "-" ? "N/A" : type,
                  sub: sub === "-" ? "N/A" : sub,
                  sub2: "N/A",
                });
              }
            });
          }
        });
      });
    });
    
    // Other standalone options
    const typeOptions = ["New Acquisition", "New Cross Sell", "Existing"];
    const prjTypeOptions = ["Recurring", "One-time"];
    const mandateHealthOptions = ["Exceeds Expectations", "Meets Expectations", "Need Improvement"];
    const clientBudgetTrendOptions = ["Increase", "Same", "Decrease"];
    const upsellActionStatusOptions = ["Not Started", "Ongoing", "Done"];
    
    // Find maximum number of rows needed
    const maxRows = Math.max(
      lobCombinations.length,
      typeOptions.length,
      prjTypeOptions.length,
      mandateHealthOptions.length,
      clientBudgetTrendOptions.length,
      upsellCombinations.length,
      upsellActionStatusOptions.length
    );
    
    // Create rows with all valid combinations starting from the same row
    // Note: Options are shifted one column to the right compared to headings
    for (let i = 0; i < maxRows; i++) {
      const row = templateHeaders.map((h, idx) => {
        if (idx < 23) return ""; // Data fields
        if (idx === 23 || idx === 24) return ""; // Gap columns
        if (idx === 25) return ""; // LoB heading column - empty
        if (idx === 26) return i < lobCombinations.length ? lobCombinations[i].lob : ""; // LoB data (shifted right)
        if (idx === 27) return i < lobCombinations.length ? lobCombinations[i].useCase : ""; // Use Case data (shifted right)
        if (idx === 28) return i < lobCombinations.length ? lobCombinations[i].subUseCase : ""; // Sub Use Case data (shifted right)
        if (idx === 29) return i < typeOptions.length ? typeOptions[i] : ""; // Type data (shifted right)
        if (idx === 30) return i < prjTypeOptions.length ? prjTypeOptions[i] : ""; // PRJ Type data (shifted right)
        if (idx === 31) return i < mandateHealthOptions.length ? mandateHealthOptions[i] : ""; // Mandate Health data (shifted right)
        if (idx === 32) return i < clientBudgetTrendOptions.length ? clientBudgetTrendOptions[i] : ""; // Client Budget Trend data (shifted right)
        if (idx === 33) return i < upsellCombinations.length ? upsellCombinations[i].constraint : ""; // Upsell Constraint data (shifted right)
        if (idx === 34) return i < upsellCombinations.length ? upsellCombinations[i].type : ""; // Upsell Constraint Type data (shifted right)
        if (idx === 35) return i < upsellCombinations.length ? upsellCombinations[i].sub : ""; // Upsell Constraint Sub data (shifted right)
        if (idx === 36) return i < upsellCombinations.length ? upsellCombinations[i].sub2 : ""; // Upsell Constraint Sub2 data (shifted right)
        if (idx === 37) return i < upsellActionStatusOptions.length ? upsellActionStatusOptions[i] : ""; // Upsell Action Status data (shifted right)
        return "";
      }).join(",");
      referenceRows.push(row);
    }
    
    const csvContent = [headerRow, ...referenceRows].join("\n");
    downloadCSV(csvContent, "mandates_upload_template.csv");
    
    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded. Fill in the data and upload it. Reference data included on the right.",
    });
  };

  const handleBulkUploadMandates = async (file: File) => {
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

      // Validate minimum and maximum entries
      const MIN_ENTRIES = 1;
      const MAX_ENTRIES = 1000;

      if (csvData.length < MIN_ENTRIES) {
        toast({
          title: "Validation Error",
          description: `CSV file must contain at least ${MIN_ENTRIES} entry.`,
          variant: "destructive",
        });
        return;
      }

      if (csvData.length > MAX_ENTRIES) {
        toast({
          title: "Validation Error",
          description: `CSV file cannot contain more than ${MAX_ENTRIES} entries. Please split your file into smaller batches.`,
          variant: "destructive",
        });
        return;
      }

      // Get account name to ID mapping for validation
      const accountNames = [...new Set(csvData.map((row: any) => row["Account Name"]).filter(Boolean))];
      const { data: accountData } = await supabase
        .from("accounts")
        .select("id, name")
        .in("name", accountNames);

      const accountMap: Record<string, string> = {};
      accountData?.forEach((acc) => {
        accountMap[acc.name] = acc.id;
      });

      // Get KAM name to ID mapping for validation
      const kamNames = [...new Set(csvData.map((row: any) => row["KAM Name"]).filter(Boolean))];
      const { data: kamData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam")
        .in("full_name", kamNames);

      const kamMap: Record<string, string> = {};
      kamData?.forEach((kam) => {
        kamMap[kam.full_name] = kam.id;
      });

      // Get existing project codes from database to check for duplicates
      const projectIds = csvData.map((row: any) => row["Project Code"]).filter(Boolean);
      const { data: existingMandates } = await supabase
        .from("mandates")
        .select("project_code")
        .in("project_code", projectIds);

      const existingProjectCodes = new Set(existingMandates?.map((m: any) => m.project_code) || []);

      // Helper functions to normalize enum values (needed for validation)
      const normalizeUpsellConstraintType = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "" || value.trim() === "-") return null;
        const normalized = value.trim();
        if (normalized.toLowerCase() === "internal") return "Internal";
        if (normalized.toLowerCase() === "external") return "External";
        if (normalized === "Internal" || normalized === "External") return normalized;
        return null;
      };

      const normalizeUpsellConstraintSub = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "" || value.trim() === "-") return null;
        const normalized = value.trim();
        if (normalized.toLowerCase() === "profitability") return "Profitability";
        if (normalized.toLowerCase() === "delivery") return "Delivery";
        if (normalized.toLowerCase() === "others") return "Others";
        if (normalized === "Profitability" || normalized === "Delivery" || normalized === "Others") return normalized;
        return null;
      };

      // Parse and validate each row
      const previewRows = csvData.map((row: any, index: number) => {
        const rowNumber = index + 2; // +2 because CSV has header and is 1-indexed
        const errors: string[] = [];
        const accountName = row["Account Name"];
        const accountId = accountMap[accountName];
        const kamName = row["KAM Name"];
        const kamId = kamMap[kamName];

        // Validate lookup fields
        if (accountName && !accountId) {
          errors.push(`Account "${accountName}" does not exist`);
        }
        if (kamName && !kamId) {
          errors.push(`KAM "${kamName}" does not exist`);
        }

        if (!accountName || accountName.trim() === "") {
          errors.push("Account Name is required");
        }
        if (!kamName || kamName.trim() === "") {
          errors.push("KAM Name is required");
        }
        if (!row["Project Code"] || row["Project Code"].trim() === "") {
          errors.push("Project Code is required");
        } else {
          const projectId = row["Project Code"].trim();
          // Check for duplicates within the CSV
          const duplicateCount = csvData.filter((r: any) => r["Project Code"]?.trim() === projectId).length;
          if (duplicateCount > 1) {
            errors.push(`Project Code "${projectId}" is duplicated in the CSV file`);
          }
          // Note: Existing Project Codes are allowed - they will be updated instead of creating new records
        }
        if (!row["Project Name"] || row["Project Name"].trim() === "") {
          errors.push("Project Name is required");
        }
        if (!row["LoB (Vertical)"] || row["LoB (Vertical)"].trim() === "") {
          errors.push("LoB (Vertical) is required");
        }

        // Validate Type field
        if (row["Type"] && !["New Acquisition", "Existing"].includes(row["Type"])) {
          errors.push("Type must be either 'New Acquisition' or 'Existing'");
        }

        // Validate upsell constraint dependent fields
        const upsellConstraint = row["Upsell Constraint"] === "YES";
        if (upsellConstraint) {
          const constraintType = normalizeUpsellConstraintType(row["Upsell Constraint Type"]);
          const constraintSub = normalizeUpsellConstraintSub(row["Upsell Constraint Type - Sub"]);
          
          if (!constraintType) {
            errors.push("Upsell Constraint Type is required when Upsell Constraint is YES");
          }
          if (!constraintSub) {
            errors.push("Upsell Constraint Type - Sub is required when Upsell Constraint is YES");
          }
          
          // Validate Sub 2 if constraint type and sub are provided
          if (constraintType && constraintSub) {
            const validSub2s = getUpsellConstraintSub2s("YES", constraintType, constraintSub);
            const sub2Value = row["Upsell Constraint Type - Sub 2"];
            if (validSub2s.length > 0 && sub2Value && !validSub2s.includes(sub2Value)) {
              errors.push(`Invalid Upsell Constraint Type - Sub 2. Must be one of: ${validSub2s.join(", ")}`);
            }
          }
        }

        return {
          rowNumber,
          data: row,
          isValid: errors.length === 0,
          errors,
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
    if (!csvFileToUpload) return;

    try {
      setLoadingMandates(true);
      setCsvPreviewOpen(false);

      const text = await csvFileToUpload.text();
      const csvData = parseCSV(text);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to upload mandates");
      }

      // Get account name to ID mapping
      const accountNames = [...new Set(csvData.map((row: any) => row["Account Name"]).filter(Boolean))];
      const { data: accountData } = await supabase
        .from("accounts")
        .select("id, name")
        .in("name", accountNames);

      const accountMap: Record<string, string> = {};
      accountData?.forEach((acc) => {
        accountMap[acc.name] = acc.id;
      });

      // Get KAM name to ID mapping
      const kamNames = [...new Set(csvData.map((row: any) => row["KAM Name"]).filter(Boolean))];
      const { data: kamData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "kam")
        .in("full_name", kamNames);

      const kamMap: Record<string, string> = {};
      kamData?.forEach((kam) => {
        kamMap[kam.full_name] = kam.id;
      });

      // Filter out invalid rows
      const validRows = csvData.filter((row: any, index: number) => {
        const previewRow = csvPreviewRows[index];
        return previewRow?.isValid;
      });

      // Helper functions to normalize enum values to match database enum exactly
      const normalizeUpsellActionStatus = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        // Map common variations to exact enum values
        if (normalized.toLowerCase() === "not started") return "Not Started";
        if (normalized.toLowerCase() === "ongoing") return "Ongoing";
        if (normalized.toLowerCase() === "done") return "Done";
        // If it matches exactly, return as is
        if (["Not Started", "Ongoing", "Done"].includes(normalized)) return normalized;
        return null;
      };

      const normalizeMandateHealth = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        if (normalized === "Exceeds Expectations" || normalized === "Meets Expectations" || normalized === "Need Improvement") {
          return normalized;
        }
        return null;
      };

      const normalizePrjType = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        if (normalized.toLowerCase() === "recurring") return "Recurring";
        if (normalized.toLowerCase() === "one-time" || normalized.toLowerCase() === "onetime") return "One-time";
        if (normalized === "Recurring" || normalized === "One-time") return normalized;
        return null;
      };

      const normalizeUpsellConstraintType = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "" || value.trim() === "-") return null;
        const normalized = value.trim();
        if (normalized.toLowerCase() === "internal") return "Internal";
        if (normalized.toLowerCase() === "external") return "External";
        if (normalized === "Internal" || normalized === "External") return normalized;
        return null;
      };

      const normalizeUpsellConstraintSub = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "" || value.trim() === "-") return null;
        const normalized = value.trim();
        if (normalized.toLowerCase() === "profitability") return "Profitability";
        if (normalized.toLowerCase() === "delivery") return "Delivery";
        if (normalized.toLowerCase() === "others") return "Others";
        if (normalized === "Profitability" || normalized === "Delivery" || normalized === "Others") return normalized;
        return null;
      };

      const normalizeClientBudgetTrend = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        if (normalized.toLowerCase() === "increase") return "Increase";
        if (normalized.toLowerCase() === "same") return "Same";
        if (normalized.toLowerCase() === "decrease") return "Decrease";
        if (normalized === "Increase" || normalized === "Same" || normalized === "Decrease") return normalized;
        return null;
      };

      const normalizeAwignSharePercent = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        if (normalized === "Below 70%" || normalized === "70% & Above") return normalized;
        return null;
      };

      // Helper function to calculate retention type based on decision tree logic
      const calculateRetentionType = (
        mandateHealth: string | null,
        upsellConstraint: boolean | null,
        clientBudgetTrend: string | null,
        awignSharePercent: string | null
      ): string | null => {
        // Level 1: Check Mandate Health Distribution
        if (mandateHealth === "Need Improvement") {
          return "NI";
        }

        // Level 2: Check Upsell Constraint (only if Mandate Health is "Exceeds/Meets")
        if (mandateHealth === "Exceeds Expectations" || mandateHealth === "Meets Expectations") {
          if (upsellConstraint === true) {
            return "E";
          }

          // Level 3: Check Current PRJ Status / Client's Budget Trends (only if Upsell Constraint = false)
          if (upsellConstraint === false && clientBudgetTrend && awignSharePercent) {
            const isAwignShare70Plus = awignSharePercent === "70% & Above";
            const isAwignShareBelow70 = awignSharePercent === "Below 70%";

            // Current PRJ Status = "Increase"
            if (clientBudgetTrend === "Increase") {
              if (isAwignShare70Plus) return "A";
              if (isAwignShareBelow70) return "B";
            }

            // Current PRJ Status = "Same"
            if (clientBudgetTrend === "Same") {
              if (isAwignShare70Plus) return "Star";
              if (isAwignShareBelow70) return "C";
            }

            // Client's Budget Trends = "Decrease"
            if (clientBudgetTrend === "Decrease") {
              // Both cases result in D according to the matrix
              return "D";
            }
          }
        }

        return null;
      };

      const mandatesToInsert = validRows.map((row: any, index: number) => {
        // Use Project Code from CSV
        const projectCode = row["Project Code"].trim();

        // Calculate MCV values
        const handoverMonthlyVolume = parseFloat(row["Handover Monthly Volume"]) || 0;
        const handoverCommercialPerHead = parseFloat(row["Handover Commercial per head/task"]) || 0;
        const handoverMcv = handoverMonthlyVolume * handoverCommercialPerHead;

        const revenueMonthlyVolume = parseFloat(row["Revenue Monthly Volume"]) || 0;
        const revenueCommercialPerHead = parseFloat(row["Revenue Commercial per head/task"]) || 0;
        const revenueMcv = revenueMonthlyVolume * revenueCommercialPerHead;

        // Normalize enum values
        const mandateHealth = normalizeMandateHealth(row["Mandate Health"]);
        const upsellConstraint = row["Upsell Constraint"] === "YES";
        const clientBudgetTrend = normalizeClientBudgetTrend(row["Client Budget Trend"]);
        const awignSharePercent = normalizeAwignSharePercent(row["Awign Share %"]);

        // Calculate retention type
        const retentionType = calculateRetentionType(
          mandateHealth,
          upsellConstraint,
          clientBudgetTrend,
          awignSharePercent
        );

        // Validate upsell constraint dependent fields
        const upsellConstraintType = normalizeUpsellConstraintType(row["Upsell Constraint Type"]);
        const upsellConstraintSub = normalizeUpsellConstraintSub(row["Upsell Constraint Type - Sub"]);
        
        // Validate that if upsell constraint is YES, the dependent fields are valid
        let validatedUpsellConstraintSub2 = row["Upsell Constraint Type - Sub 2"] || null;
        if (upsellConstraint === true && upsellConstraintType && upsellConstraintSub) {
          const validSub2s = getUpsellConstraintSub2s("YES", upsellConstraintType, upsellConstraintSub);
          // If there are valid sub2 options and the provided value is not in the list, set to null
          if (validSub2s.length > 0 && validatedUpsellConstraintSub2 && !validSub2s.includes(validatedUpsellConstraintSub2)) {
            validatedUpsellConstraintSub2 = null;
          }
          // If there are no valid sub2 options, set to null (it's a free text field)
          if (validSub2s.length === 0) {
            // Keep the value as is (free text)
          }
        } else if (upsellConstraint === false) {
          // If upsell constraint is NO, clear dependent fields
          validatedUpsellConstraintSub2 = null;
        }

        return {
          project_code: projectCode,
          project_name: row["Project Name"],
          account_id: accountMap[row["Account Name"]],
          kam_id: kamMap[row["KAM Name"]],
          lob: row["LoB (Vertical)"],
          type: row["Type"] && ["New Acquisition", "Existing"].includes(row["Type"]) ? row["Type"] : null,
          new_sales_owner: row["New Sales Owner"] || null,
          handover_monthly_volume: handoverMonthlyVolume || null,
          handover_commercial_per_head: handoverCommercialPerHead || null,
          handover_mcv: handoverMcv || null,
          prj_duration_months: parseInt(row["PRJ duration in months"]) || null,
          handover_acv: parseFloat(row["Handover ACV"]) || null,
          handover_prj_type: normalizePrjType(row["Handover PRJ Type"]),
          revenue_monthly_volume: revenueMonthlyVolume || null,
          revenue_commercial_per_head: revenueCommercialPerHead || null,
          revenue_mcv: revenueMcv || null,
          revenue_acv: parseFloat(row["Revenue ACV"]) || null,
          revenue_prj_type: normalizePrjType(row["Revenue PRJ Type"]),
          mandate_health: mandateHealth,
          upsell_constraint: upsellConstraint,
          upsell_constraint_type: upsellConstraintType,
          upsell_constraint_sub: upsellConstraintSub,
          upsell_constraint_sub2: validatedUpsellConstraintSub2,
          client_budget_trend: clientBudgetTrend,
          awign_share_percent: awignSharePercent,
          retention_type: retentionType,
          upsell_action_status: normalizeUpsellActionStatus(row["Upsell Action Status"]),
          created_by: user.id,
        };
      });

      // Upsert mandates in batches (update if exists, insert if new)
      const batchSize = 50;
      let successCount = 0;
      let updateCount = 0;
      let insertCount = 0;
      let errorCount = 0;

      // Get all project codes to check which ones exist
      const projectCodes = mandatesToInsert.map((m: any) => m.project_code);
      const { data: existingMandates } = await supabase
        .from("mandates")
        .select("id, project_code")
        .in("project_code", projectCodes);

      const existingMandateMap: Record<string, string> = {};
      existingMandates?.forEach((m: any) => {
        existingMandateMap[m.project_code] = m.id;
      });

      for (let i = 0; i < mandatesToInsert.length; i += batchSize) {
        const batch = mandatesToInsert.slice(i, i + batchSize);
        
        // Separate into updates and inserts
        const toUpdate: any[] = [];
        const toInsert: any[] = [];

        batch.forEach((mandate: any) => {
          const existingId = existingMandateMap[mandate.project_code];
          if (existingId) {
            // Update existing
            toUpdate.push({ ...mandate, id: existingId });
          } else {
            // Insert new
            toInsert.push(mandate);
          }
        });

        // Update existing mandates
        for (const mandate of toUpdate) {
          const { id, ...updateData } = mandate;
          const { error } = await supabase
            .from("mandates")
            .update(updateData)
            .eq("id", id);
          
          if (error) {
            console.error("Error updating mandate:", error);
            errorCount++;
          } else {
            updateCount++;
            successCount++;
          }
        }

        // Insert new mandates
        if (toInsert.length > 0) {
          const { error } = await supabase.from("mandates").insert(toInsert);
          
          if (error) {
            console.error("Error inserting batch:", error);
            errorCount += toInsert.length;
          } else {
            insertCount += toInsert.length;
            successCount += toInsert.length;
          }
        }
      }

      toast({
        title: "Upload Complete",
        description: `Successfully processed ${successCount} mandates (${insertCount} inserted, ${updateCount} updated). ${errorCount > 0 ? `${errorCount} failed.` : ""}`,
      });

      // Reset preview state
      setCsvPreviewRows([]);
      setCsvFileToUpload(null);

      // Close Add Mandate dialog if open
      setFormDialogOpen(false);

      // Refresh mandates list
      fetchMandates();
    } catch (error: any) {
      console.error("Error uploading mandates:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload mandates. Please check the CSV format.",
        variant: "destructive",
      });
    } finally {
      setLoadingMandates(false);
    }
  };

  const handleCancelUpload = () => {
    setCsvPreviewOpen(false);
    setCsvPreviewRows([]);
    setCsvFileToUpload(null);
  };

  const handleBulkUploadMcv = async (file: File) => {
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

      // Validate minimum and maximum entries
      const MIN_ENTRIES = 1;
      const MAX_ENTRIES = 1000;

      if (csvData.length < MIN_ENTRIES) {
        toast({
          title: "Validation Error",
          description: `CSV file must contain at least ${MIN_ENTRIES} entry.`,
          variant: "destructive",
        });
        return;
      }

      if (csvData.length > MAX_ENTRIES) {
        toast({
          title: "Validation Error",
          description: `CSV file cannot contain more than ${MAX_ENTRIES} entries. Please split your file into smaller batches.`,
          variant: "destructive",
        });
        return;
      }

      // Get all project codes from CSV
      const projectIds = [...new Set(csvData.map((row: any) => row["Project Code"]).filter(Boolean))];
      
      // Fetch existing mandates to validate project IDs
      const { data: existingMandates } = await supabase
        .from("mandates")
        .select("id, project_code, monthly_data")
        .in("project_code", projectIds);

      const mandateMap: Record<string, any> = {};
      existingMandates?.forEach((mandate: any) => {
        mandateMap[mandate.project_code] = mandate;
      });

      // Parse and validate each row
      const previewRows = csvData.map((row: any, index: number) => {
        const rowNumber = index + 2; // +2 because CSV has header and is 1-indexed
        const errors: string[] = [];
        const projectId = row["Project Code"]?.trim();
        const month = row["Month"]?.trim();
        const year = row["Year"]?.trim();
        const achievedMcv = row["Achieved MCV"]?.trim();

        // Validate Project Code
        if (!projectId || projectId === "") {
          errors.push("Project Code is required");
        } else if (!mandateMap[projectId]) {
          errors.push(`Project Code "${projectId}" does not exist in the database`);
        }

        // Validate Month
        if (!month || month === "") {
          errors.push("Month is required");
        } else {
          const monthNum = parseInt(month);
          if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            errors.push("Month must be a number between 1 and 12");
          }
        }

        // Validate Year
        if (!year || year === "") {
          errors.push("Year is required");
        } else {
          const yearNum = parseInt(year);
          if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            errors.push("Year must be a valid year (2000-2100)");
          }
        }

        // Validate Achieved MCV
        if (!achievedMcv || achievedMcv === "") {
          errors.push("Achieved MCV is required");
        } else {
          const achievedMcvNum = parseFloat(achievedMcv);
          if (isNaN(achievedMcvNum) || achievedMcvNum < 0) {
            errors.push("Achieved MCV must be a valid number >= 0");
          }
        }

        return {
          rowNumber,
          data: row,
          isValid: errors.length === 0,
          errors,
        };
      });

      // Store preview data and open dialog
      setMcvCsvPreviewRows(previewRows);
      setMcvCsvFileToUpload(file);
      setMcvCsvPreviewOpen(true);
      setBulkUpdateMcvDialogOpen(false);
    } catch (error: any) {
      console.error("Error parsing CSV:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to parse CSV file. Please check the format.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmMcvUpload = async () => {
    if (!mcvCsvFileToUpload) return;

    try {
      setLoadingMandates(true);
      setMcvCsvPreviewOpen(false);

      const text = await mcvCsvFileToUpload.text();
      const csvData = parseCSV(text);

      // Get all project codes from CSV
      const projectIds = [...new Set(csvData.map((row: any) => row["Project Code"]).filter(Boolean))];
      
      // Fetch existing mandates
      const { data: existingMandates } = await supabase
        .from("mandates")
        .select("id, project_code, monthly_data")
        .in("project_code", projectIds);

      const mandateMap: Record<string, any> = {};
      existingMandates?.forEach((mandate: any) => {
        mandateMap[mandate.project_code] = mandate;
      });

      // Filter valid rows
      const validRows = mcvCsvPreviewRows.filter((row) => row.isValid);

      if (validRows.length === 0) {
        toast({
          title: "Error",
          description: "No valid rows to upload.",
          variant: "destructive",
        });
        setLoadingMandates(false);
        return;
      }

      // Group updates by mandate ID
      const updatesByMandate: Record<string, any> = {};

      validRows.forEach((row) => {
        const projectId = row.data["Project Code"]?.trim();
        const mandate = mandateMap[projectId];
        
        if (!mandate) return;

        const month = parseInt(row.data["Month"]?.trim());
        const year = parseInt(row.data["Year"]?.trim());
        const achievedMcv = parseFloat(row.data["Achieved MCV"]?.trim());

        const monthYear = `${year}-${String(month).padStart(2, '0')}`;

        if (!updatesByMandate[mandate.id]) {
          // Start with existing monthly_data to preserve existing records
          updatesByMandate[mandate.id] = {
            id: mandate.id,
            monthly_data: mandate.monthly_data ? { ...mandate.monthly_data } : {},
          };
        }

        // Add or update monthly_data for this mandate (merge with existing)
        // Store only achieved MCV (not planned)
        updatesByMandate[mandate.id].monthly_data[monthYear] = achievedMcv;
      });

      // Update mandates in batches
      const batchSize = 50;
      const mandateIds = Object.keys(updatesByMandate);
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < mandateIds.length; i += batchSize) {
        const batch = mandateIds.slice(i, i + batchSize);
        
        for (const mandateId of batch) {
          const update = updatesByMandate[mandateId];
          const { error } = await supabase
            .from("mandates")
            .update({ monthly_data: update.monthly_data })
            .eq("id", update.id);

          if (error) {
            console.error("Error updating mandate:", error);
            errorCount++;
          } else {
            successCount++;
          }
        }
      }

      toast({
        title: "Upload Complete",
        description: `Successfully updated ${successCount} mandate(s). ${errorCount > 0 ? `${errorCount} failed.` : ""}`,
      });

      // Reset preview state
      setMcvCsvPreviewRows([]);
      setMcvCsvFileToUpload(null);

      // Close Bulk Update MCV dialog if open
      setBulkUpdateMcvDialogOpen(false);

      // Refresh mandates list
      fetchMandates();
    } catch (error: any) {
      console.error("Error uploading MCV data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload MCV data. Please check the CSV format.",
        variant: "destructive",
      });
    } finally {
      setLoadingMandates(false);
    }
  };

  const handleExportMandates = async () => {
    try {
      setLoadingMandates(true);
      
      // Use filtered mandates if filters are active, otherwise fetch all
      let dataToExport: any[];
      
      if (hasActiveFilters) {
        // Export filtered mandates - need to fetch full data with relations for filtered mandates
        const filteredMandateIds = filteredMandates.map(m => m.id);
        if (filteredMandateIds.length === 0) {
          toast({
            title: "No data",
            description: "No mandates found to export.",
            variant: "default",
          });
          return;
        }
        
        const { data, error } = await supabase
          .from("mandates")
          .select(`
            *,
            accounts:account_id (
              id,
              name
            ),
            profiles:kam_id (
              id,
              full_name
            )
          `)
          .in("id", filteredMandateIds)
          .order("created_at", { ascending: false });

        if (error) throw error;
        dataToExport = data || [];
      } else {
        // Fetch all mandates with related data
        const { data, error } = await supabase
          .from("mandates")
          .select(`
            *,
            accounts:account_id (
              id,
              name
            ),
            profiles:kam_id (
              id,
              full_name
            )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;
        dataToExport = data || [];
      }

      if (!dataToExport || dataToExport.length === 0) {
        toast({
          title: "No data",
          description: "No mandates found to export.",
          variant: "default",
        });
        return;
      }

      // Prepare data for CSV with all fields
      const csvData = dataToExport.map((mandate: any) => ({
        id: mandate.id || "",
        project_code: mandate.project_code || "",
        project_name: mandate.project_name || "",
        account_id: mandate.account_id || "",
        account_name: mandate.accounts?.name || "",
        kam_id: mandate.kam_id || "",
        kam_name: mandate.profiles?.full_name || "",
        lob: mandate.lob || "",
        type: mandate.type || "",
        new_sales_owner: mandate.new_sales_owner || "",
        handover_monthly_volume: mandate.handover_monthly_volume || 0,
        handover_commercial_per_head: mandate.handover_commercial_per_head || 0,
        handover_mcv: mandate.handover_mcv || 0,
        prj_duration_months: mandate.prj_duration_months || "",
        handover_acv: mandate.handover_acv || 0,
        handover_prj_type: mandate.handover_prj_type || "",
        revenue_monthly_volume: mandate.revenue_monthly_volume || 0,
        revenue_commercial_per_head: mandate.revenue_commercial_per_head || 0,
        revenue_mcv: mandate.revenue_mcv || 0,
        revenue_acv: mandate.revenue_acv || 0,
        revenue_prj_type: mandate.revenue_prj_type || "",
        mandate_health: mandate.mandate_health || "",
        upsell_constraint: mandate.upsell_constraint ? "YES" : "NO",
        upsell_constraint_type: mandate.upsell_constraint_type || "",
        upsell_constraint_sub: mandate.upsell_constraint_sub || "",
        upsell_constraint_sub2: mandate.upsell_constraint_sub2 || "",
        client_budget_trend: mandate.client_budget_trend || "",
        awign_share_percent: mandate.awign_share_percent || "",
        retention_type: mandate.retention_type || "",
        upsell_action_status: mandate.upsell_action_status || "",
        created_at: formatTimestampForCSV(mandate.created_at),
        updated_at: formatTimestampForCSV(mandate.updated_at),
        created_by: mandate.created_by || "",
      }));

      const csvContent = convertToCSV(csvData);
      const filename = hasActiveFilters 
        ? `filtered_mandates_export_${new Date().toISOString().split("T")[0]}.csv`
        : `mandates_export_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCSV(csvContent, filename);

      toast({
        title: "Success!",
        description: `Exported ${csvData.length} ${hasActiveFilters ? 'filtered ' : ''}mandates to CSV.`,
      });
    } catch (error: any) {
      console.error("Error exporting mandates:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to export mandates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingMandates(false);
    }
  };

  const fetchMandates = async () => {
    setLoadingMandates(true);
    try {
      const { data, error } = await supabase
        .from("mandates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch KAM names and account names separately
      const kamIds = [...new Set((data || []).map((m: any) => m.kam_id).filter(Boolean))];
      const accountIds = [...new Set((data || []).map((m: any) => m.account_id).filter(Boolean))];

      const kamMap: Record<string, string> = {};
      const accountMap: Record<string, string> = {};

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

      if (accountIds.length > 0) {
        // Try to fetch from accounts table, fallback to profiles if accounts doesn't exist
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

      // Transform data for display (keep full data for details modal)
      const transformedMandates = (data || []).map((mandate: any) => ({
        ...mandate, // Keep all original fields for details modal
        id: mandate.id,
        projectCode: mandate.project_code,
        projectName: mandate.project_name,
        account: mandate.account_id ? (accountMap[mandate.account_id] || "N/A") : "N/A",
        kam: mandate.kam_id ? (kamMap[mandate.kam_id] || "N/A") : "N/A",
        lob: mandate.lob,
        acv: mandate.revenue_acv ? mandate.revenue_acv.toLocaleString("en-IN") : "N/A",
        mcv: mandate.revenue_mcv ? mandate.revenue_mcv.toLocaleString("en-IN") : "N/A",
        mandateHealth: mandate.mandate_health || "N/A",
        upsellStatus: mandate.upsell_action_status || "N/A",
        retentionType: mandate.retention_type || "N/A",
      }));

      setMandates(transformedMandates);

      // Extract unique LoB values for filter
      const uniqueLobs = [...new Set((data || []).map((m: any) => m.lob).filter(Boolean))];
      setAvailableLobs(uniqueLobs.sort());
      
      // Extract unique Retention Type values for filter
      const uniqueRetentionTypes = [...new Set((data || []).map((m: any) => m.retention_type).filter(Boolean))];
      setAvailableRetentionTypes(uniqueRetentionTypes.sort());
    } catch (error: any) {
      console.error("Error fetching mandates:", error);
      toast({
        title: "Error",
        description: "Failed to load mandates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingMandates(false);
    }
  };

  // Fetch mandates when switching to view mode
  useEffect(() => {
    if (viewMode === "view") {
      fetchMandates();
    }
  }, [viewMode]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterAccount("all");
    setFilterKam("all");
    setFilterLob("all");
    setFilterMandateHealth("all");
    setFilterUpsellStatus("all");
    setFilterRetentionType("all");
  };

  const handleViewDetails = (mandate: any) => {
    setSelectedMandate(mandate);
    setEditMandateData({
      projectCode: mandate.project_code || "",
      projectName: mandate.project_name || "",
      accountId: mandate.account_id || "",
      kamId: mandate.kam_id || "",
      lob: mandate.lob || "",
      useCase: mandate.use_case || "",
      subUseCase: mandate.sub_use_case || "",
      type: mandate.type || "",
      newSalesOwner: mandate.new_sales_owner || "",
      handoverMonthlyVolume: mandate.handover_monthly_volume?.toString() || "",
      handoverCommercialPerHead: mandate.handover_commercial_per_head?.toString() || "",
      handoverMcv: mandate.handover_mcv?.toString() || "",
      prjDurationMonths: mandate.prj_duration_months?.toString() || "",
      handoverAcv: mandate.handover_acv?.toString() || "",
      handoverPrjType: mandate.handover_prj_type || "",
      revenueMonthlyVolume: mandate.revenue_monthly_volume?.toString() || "",
      revenueCommercialPerHead: mandate.revenue_commercial_per_head?.toString() || "",
      revenueMcv: mandate.revenue_mcv?.toString() || "",
      revenueAcv: mandate.revenue_acv?.toString() || "",
      revenuePrjType: mandate.revenue_prj_type || "",
      mandateHealth: mandate.mandate_health || "",
      upsellConstraint: mandate.upsell_constraint ? "YES" : "NO",
      upsellConstraintType: mandate.upsell_constraint_type || "",
      upsellConstraintSub: mandate.upsell_constraint_sub || "",
      upsellConstraintSub2: mandate.upsell_constraint_sub2 || "",
      clientBudgetTrend: mandate.client_budget_trend || "",
      awignSharePercent: mandate.awign_share_percent || "",
      retentionType: mandate.retention_type || "",
      upsellActionStatus: mandate.upsell_action_status || "",
    });
    setIsEditMode(false);
    setIsMandateCheckerEditMode(false);
    setDetailsModalOpen(true);
  };

  const handleDeleteMandate = async () => {
    if (!mandateToDelete?.id) return;

    setDeletingMandate(true);
    try {
      const { error } = await supabase
        .from("mandates")
        .delete()
        .eq("id", mandateToDelete.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Mandate deleted successfully",
      });

      // Refresh mandates list
      fetchMandates();
      setDeleteDialogOpen(false);
      setMandateToDelete(null);
    } catch (error: any) {
      console.error("Error deleting mandate:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete mandate",
        variant: "destructive",
      });
    } finally {
      setDeletingMandate(false);
    }
  };

  const handleUpdateMandate = async () => {
    if (!selectedMandate) return;
    
    setUpdatingMandate(true);
    try {
      const updateData: any = {
        project_code: editMandateData.projectCode || null,
        project_name: editMandateData.projectName || null,
        account_id: sanitizeValue(editMandateData.accountId),
        kam_id: sanitizeValue(editMandateData.kamId),
        lob: ensureEnumValue(editMandateData.lob, [
          'Diligence & Audit',
          'New Business Development',
          'Digital Gigs',
          'Awign Expert',
          'Last Mile Operations',
          'Invigilation & Proctoring',
          'Staffing',
          'Others'
        ]) || editMandateData.lob || null,
        use_case: ensureEnumValue(editMandateData.useCase, [
          'Mystery Audit',
          'Non-Mystery Audit',
          'Background Verification',
          'Promoters Deployment',
          'Fixed Resource Deployment',
          'New Customer Acquisition',
          'Retailer Activation',
          'Society Activation',
          'Content Operations',
          'Telecalling',
          'Market Survey',
          'Edtech',
          'SaaS',
          'Others'
        ]),
        sub_use_case: ensureEnumValue(editMandateData.subUseCase, [
          'Stock Audit',
          'Store Audit',
          'Warehouse Audit',
          'Retail Outlet Audit',
          'Distributor Audit',
          'Others'
        ]),
        type: ensureEnumValue(editMandateData.type, [
          'New Acquisition',
          'New Cross Sell',
          'Existing'
        ]),
        // Handover Info - Set to null if type is "New Cross Sell"
        new_sales_owner: editMandateData.type === "New Cross Sell" ? null : sanitizeValue(editMandateData.newSalesOwner),
        handover_monthly_volume: editMandateData.type === "New Cross Sell" ? null : (editMandateData.handoverMonthlyVolume ? parseFloat(editMandateData.handoverMonthlyVolume) : null),
        handover_commercial_per_head: editMandateData.type === "New Cross Sell" ? null : (editMandateData.handoverCommercialPerHead ? parseFloat(editMandateData.handoverCommercialPerHead) : null),
        handover_mcv: editMandateData.type === "New Cross Sell" ? null : (editMandateData.handoverMcv ? parseFloat(editMandateData.handoverMcv) : null),
        prj_duration_months: editMandateData.type === "New Cross Sell" ? null : (editMandateData.prjDurationMonths ? parseInt(editMandateData.prjDurationMonths) : null),
        handover_acv: editMandateData.type === "New Cross Sell" ? null : (editMandateData.handoverAcv ? parseFloat(editMandateData.handoverAcv) : null),
        handover_prj_type: editMandateData.type === "New Cross Sell" ? null : ensureEnumValue(editMandateData.handoverPrjType, ['Recurring', 'One-time']),
        revenue_monthly_volume: editMandateData.revenueMonthlyVolume ? parseFloat(editMandateData.revenueMonthlyVolume) : null,
        revenue_commercial_per_head: editMandateData.revenueCommercialPerHead ? parseFloat(editMandateData.revenueCommercialPerHead) : null,
        revenue_mcv: editMandateData.revenueMcv ? parseFloat(editMandateData.revenueMcv) : null,
        revenue_acv: editMandateData.revenueAcv ? parseFloat(editMandateData.revenueAcv) : null,
        revenue_prj_type: ensureEnumValue(editMandateData.revenuePrjType, ['Recurring', 'One-time']),
        mandate_health: ensureEnumValue(editMandateData.mandateHealth, [
          'Exceeds Expectations',
          'Meets Expectations',
          'Need Improvement'
        ]),
        upsell_constraint: editMandateData.upsellConstraint === "YES" ? "YES" : (editMandateData.upsellConstraint === "NO" ? "NO" : null),
        upsell_constraint_type: ensureEnumValue(editMandateData.upsellConstraintType, ['Internal', 'External']),
        upsell_constraint_sub: ensureEnumValue(editMandateData.upsellConstraintSub, [
          'Profitability',
          'Delivery',
          'Others',
          'Not enough demand',
          'Collection Issue'
        ]),
        upsell_constraint_sub2: sanitizeValue(editMandateData.upsellConstraintSub2), // Can be free text
        client_budget_trend: ensureEnumValue(editMandateData.clientBudgetTrend, ['Increase', 'Same', 'Decrease']),
        awign_share_percent: ensureEnumValue(editMandateData.awignSharePercent, ['Below 70%', '70% & Above']),
        retention_type: ensureEnumValue(editMandateData.retentionType, ['STAR', 'A', 'B', 'C', 'D', 'E', 'NI']),
        upsell_action_status: ensureEnumValue(editMandateData.upsellActionStatus, ['Not Started', 'Ongoing', 'Done']),
      };

      const { error } = await supabase
        .from("mandates")
        .update(updateData)
        .eq("id", selectedMandate.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Mandate updated successfully.",
      });

      setIsEditMode(false);
      setDetailsModalOpen(false);
      fetchMandates();
    } catch (error: any) {
      console.error("Error updating mandate:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update mandate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingMandate(false);
    }
  };

  const handleUpdateMandateChecker = async () => {
    if (!selectedMandate) return;
    
    setUpdatingMandateChecker(true);
    try {
      const updateData: any = {
        mandate_health: ensureEnumValue(editMandateData.mandateHealth, [
          'Exceeds Expectations',
          'Meets Expectations',
          'Need Improvement'
        ]),
        upsell_constraint: editMandateData.upsellConstraint === "YES" ? "YES" : (editMandateData.upsellConstraint === "NO" ? "NO" : null),
        upsell_constraint_type: ensureEnumValue(editMandateData.upsellConstraintType, ['Internal', 'External']),
        upsell_constraint_sub: ensureEnumValue(editMandateData.upsellConstraintSub, [
          'Profitability',
          'Delivery',
          'Others',
          'Not enough demand',
          'Collection Issue'
        ]),
        upsell_constraint_sub2: sanitizeValue(editMandateData.upsellConstraintSub2), // Can be free text
        client_budget_trend: ensureEnumValue(editMandateData.clientBudgetTrend, ['Increase', 'Same', 'Decrease']),
        awign_share_percent: ensureEnumValue(editMandateData.awignSharePercent, ['Below 70%', '70% & Above']),
        retention_type: ensureEnumValue(editMandateData.retentionType, ['STAR', 'A', 'B', 'C', 'D', 'E', 'NI']),
      };

      const { error } = await supabase
        .from("mandates")
        .update(updateData)
        .eq("id", selectedMandate.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Mandate Checker updated successfully.",
      });

      setIsMandateCheckerEditMode(false);
      fetchMandates();
      // Refresh the selected mandate data
      const { data: updatedMandate } = await supabase
        .from("mandates")
        .select("*")
        .eq("id", selectedMandate.id)
        .single();
      
      if (updatedMandate) {
        setSelectedMandate(updatedMandate);
        setEditMandateData({
          ...editMandateData,
          mandateHealth: updatedMandate.mandate_health || "",
          upsellConstraint: updatedMandate.upsell_constraint ? "YES" : "NO",
          upsellConstraintType: updatedMandate.upsell_constraint_type || "",
          upsellConstraintSub: updatedMandate.upsell_constraint_sub || "",
          upsellConstraintSub2: updatedMandate.upsell_constraint_sub2 || "",
          clientBudgetTrend: updatedMandate.client_budget_trend || "",
          awignSharePercent: updatedMandate.awign_share_percent || "",
          retentionType: updatedMandate.retention_type || "",
        });
      }
    } catch (error: any) {
      console.error("Error updating mandate checker:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update mandate checker. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingMandateChecker(false);
    }
  };

  const filteredMandates = mandates.filter((mandate) => {
    // Search across all displayed fields
    const matchesSearch = !searchTerm || (() => {
      const searchLower = searchTerm.toLowerCase();
      const searchableFields = [
        mandate.projectCode || "",
        mandate.projectName || "",
        mandate.account || "",
        mandate.kam || "",
        mandate.lob || "",
        mandate.acv || "",
        mandate.mcv || "",
        mandate.mandateHealth || "",
        mandate.upsellStatus || "",
        mandate.retentionType || "",
      ];
      return searchableFields.some(field => field.toLowerCase().includes(searchLower));
    })();
    
    const matchesAccount = filterAccount === "all" || mandate.account_id === filterAccount;
    const matchesKam = filterKam === "all" || mandate.kam_id === filterKam;
    const matchesLob = filterLob === "all" || mandate.lob === filterLob;
    const matchesHealth = filterMandateHealth === "all" || mandate.mandateHealth === filterMandateHealth;
    const matchesStatus = filterUpsellStatus === "all" || mandate.upsellStatus === filterUpsellStatus;
    const matchesRetentionType = filterRetentionType === "all" || mandate.retention_type === filterRetentionType;

    return matchesSearch && matchesAccount && matchesKam && matchesLob && matchesHealth && matchesStatus && matchesRetentionType;
  });

  // Check if any filters are active
  const hasActiveFilters = searchTerm || filterAccount !== "all" || filterKam !== "all" || filterLob !== "all" || filterMandateHealth !== "all" || filterUpsellStatus !== "all" || filterRetentionType !== "all";

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mandates</h1>
          <p className="text-muted-foreground">
            Track and manage client orders and project mandates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportMandates}
            disabled={loadingMandates}
          >
            <Download className="mr-2 h-4 w-4" />
            {hasActiveFilters ? "Download Filtered Mandates" : "Export Mandates"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setBulkUpdateMcvDialogOpen(true)}
          >
            Bulk Update MCV
          </Button>
          <Button
            variant="outline"
            onClick={() => setBulkUploadCasesDialogOpen(true)}
          >
            Bulk Upload Mandates
          </Button>
          <Button onClick={() => setFormDialogOpen(true)}>
            Add Mandate
          </Button>
        </div>
      </div>

      {/* Add Mandate Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => {
        setFormDialogOpen(open);
        if (!open) {
          // Reset form when dialog closes
          setFormData({
            projectCode: "",
            projectName: "",
            accountId: "",
            kamId: "",
            lob: "",
            useCase: "",
            subUseCase: "",
            type: "",
            newSalesOwner: "",
            handoverMonthlyVolume: "",
            handoverCommercialPerHead: "",
            handoverMcv: "",
            prjDurationMonths: "",
            handoverAcv: "",
            handoverPrjType: "",
            revenueMonthlyVolume: "",
            revenueCommercialPerHead: "",
            revenueMcv: "",
            revenueAcv: "",
            revenuePrjType: "",
            mandateHealth: "",
            upsellConstraint: "",
            upsellConstraintType: "",
            upsellConstraintSub: "",
            upsellConstraintSub2: "",
            clientBudgetTrend: "",
            awignSharePercent: "",
            retentionType: "",
            upsellActionStatus: "",
          });
          setAccountSearch("");
          setKamSearch("");
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Mandate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1st Section: Project Information */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">Project Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectCode">
                      Project Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="projectCode"
                      value={formData.projectCode}
                      onChange={(e) => handleInputChange("projectCode", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lob">
                      LoB (Vertical) <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.lob}
                      onValueChange={(value) => handleInputChange("lob", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select LoB" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Diligence & Audit">Diligence & Audit</SelectItem>
                        <SelectItem value="New Business Development">New Business Development</SelectItem>
                        <SelectItem value="Digital Gigs">Digital Gigs</SelectItem>
                        <SelectItem value="Awign Expert">Awign Expert</SelectItem>
                        <SelectItem value="Last Mile Operations">Last Mile Operations</SelectItem>
                        <SelectItem value="Invigilation & Proctoring">Invigilation & Proctoring</SelectItem>
                        <SelectItem value="Staffing">Staffing</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectName">
                      Project Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="projectName"
                      value={formData.projectName}
                      onChange={(e) => handleInputChange("projectName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="useCase">
                      Use Case <span className="text-destructive">*</span>
                    </Label>
                    {formData.lob && hasOnlyDashUseCase(formData.lob) ? (
                      <Input
                        id="useCase"
                        value="-"
                        readOnly
                        className="bg-muted"
                      />
                    ) : (
                      <Select
                        value={formData.useCase}
                        onValueChange={(value) => handleInputChange("useCase", value)}
                        required
                        disabled={!formData.lob || hasOnlyDashUseCase(formData.lob)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Use Case" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.lob ? (
                            getUseCasesForLob(formData.lob).length > 0 ? (
                              getUseCasesForLob(formData.lob).map((useCase) => (
                                <SelectItem key={useCase} value={useCase}>
                                  {useCase}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No use cases available
                              </div>
                            )
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              Select LoB first
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountId">
                      Account Name <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.accountId}
                      onValueChange={(value) => handleInputChange("accountId", value)}
                      required
                    >
                      <SelectTrigger>
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
                        {accounts.length > 0 ? (
                          accounts
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
                            No accounts available
                          </div>
                        )}
                        {accounts.length > 0 && accounts.filter((account) =>
                          account.name.toLowerCase().includes(accountSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No accounts found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subUseCase">
                      Sub Use Case <span className="text-destructive">*</span>
                    </Label>
                    {formData.lob && formData.useCase && hasOnlyDashSubUseCase(formData.lob, formData.useCase) ? (
                      <Input
                        id="subUseCase"
                        value="-"
                        readOnly
                        className="bg-muted"
                      />
                    ) : (
                      <Select
                        value={formData.subUseCase}
                        onValueChange={(value) => handleInputChange("subUseCase", value)}
                        required
                        disabled={!formData.lob || !formData.useCase || hasOnlyDashSubUseCase(formData.lob, formData.useCase)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Sub Use Case" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.lob && formData.useCase ? (
                            getSubUseCasesForUseCase(formData.lob, formData.useCase).length > 0 ? (
                              getSubUseCasesForUseCase(formData.lob, formData.useCase).map((subUseCase) => (
                                <SelectItem key={subUseCase} value={subUseCase}>
                                  {subUseCase}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No sub use cases available
                              </div>
                            )
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              {!formData.lob ? "Select LoB first" : "Select Use Case first"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kamId">
                      KAM (CE in charge) <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.kamId}
                      onValueChange={(value) => handleInputChange("kamId", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select KAM" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Search KAMs..."
                            value={kamSearch}
                            onChange={(e) => setKamSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                        </div>
                        {kams.length > 0 ? (
                          kams
                            .filter((kam) =>
                              (kam.full_name || "Unknown").toLowerCase().includes(kamSearch.toLowerCase())
                            )
                            .map((kam) => (
                              <SelectItem key={kam.id} value={kam.id}>
                                {kam.full_name || "Unknown"}
                              </SelectItem>
                            ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No KAMs available
                          </div>
                        )}
                        {kams.length > 0 && kams.filter((kam) =>
                          (kam.full_name || "Unknown").toLowerCase().includes(kamSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No KAMs found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">
                      Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleInputChange("type", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New Acquisition">New Acquisition</SelectItem>
                        <SelectItem value="New Cross Sell">New Cross Sell</SelectItem>
                        <SelectItem value="Existing">Existing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Section: Handover Info */}
              {(formData.type === "New Acquisition" || formData.type === "Existing") && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Handover Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="newSalesOwner">New Sales Owner</Label>
                      <Input
                        id="newSalesOwner"
                        value={formData.newSalesOwner}
                        onChange={(e) => handleInputChange("newSalesOwner", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handoverMcv">
                        MCV <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="handoverMcv"
                        value={formData.handoverMcv}
                        placeholder="Auto"
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handoverAcv">
                        ACV <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="handoverAcv"
                        type="number"
                        value={formData.handoverAcv}
                        onChange={(e) => handleInputChange("handoverAcv", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handoverMonthlyVolume">
                        Monthly Volume <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="handoverMonthlyVolume"
                        type="number"
                        value={formData.handoverMonthlyVolume}
                        onChange={(e) => handleInputChange("handoverMonthlyVolume", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prjDurationMonths">
                        PRJ duration in months <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.prjDurationMonths}
                        onValueChange={(value) => handleInputChange("prjDurationMonths", value)}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select months (1-12)" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                            <SelectItem key={month} value={month.toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        How many months of PRJ in the next 12 months (1–12)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handoverCommercialPerHead">
                        Commercial per head/task <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="handoverCommercialPerHead"
                        type="number"
                        value={formData.handoverCommercialPerHead}
                        onChange={(e) => handleInputChange("handoverCommercialPerHead", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handoverPrjType">
                        PRJ Type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.handoverPrjType}
                        onValueChange={(value) => handleInputChange("handoverPrjType", value)}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Recurring">Recurring</SelectItem>
                          <SelectItem value="One-time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* 3rd Section: Revenue Info */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Revenue Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="revenueMcv">
                        MCV <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="revenueMcv"
                        value={formData.revenueMcv}
                        placeholder="Auto"
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenueMonthlyVolume">
                        Monthly Volume <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="revenueMonthlyVolume"
                        type="number"
                        value={formData.revenueMonthlyVolume}
                        onChange={(e) => handleInputChange("revenueMonthlyVolume", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenueAcv">
                        ACV <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="revenueAcv"
                        type="number"
                        value={formData.revenueAcv}
                        onChange={(e) => handleInputChange("revenueAcv", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenueCommercialPerHead">
                        Commercial per head/task <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="revenueCommercialPerHead"
                        type="number"
                        value={formData.revenueCommercialPerHead}
                        onChange={(e) => handleInputChange("revenueCommercialPerHead", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenuePrjType">
                        PRJ Type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.revenuePrjType}
                        onValueChange={(value) => handleInputChange("revenuePrjType", value)}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Recurring">Recurring</SelectItem>
                          <SelectItem value="One-time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4th Section: Mandate Checker */}
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-orange-900">Mandate Checker</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mandateHealth">
                      Mandate Health <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.mandateHealth}
                      onValueChange={(value) => handleInputChange("mandateHealth", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select health" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Exceeds Expectations">Exceeds Expectations</SelectItem>
                        <SelectItem value="Meets Expectations">Meets Expectations</SelectItem>
                        <SelectItem value="Need Improvement">Need Improvement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientBudgetTrend">
                      Client Budget Trend <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.clientBudgetTrend}
                      onValueChange={(value) => handleInputChange("clientBudgetTrend", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trend" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Increase">Increase</SelectItem>
                        <SelectItem value="Same">Same</SelectItem>
                        <SelectItem value="Decrease">Decrease</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upsellConstraint">
                      Upsell Constraint <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.upsellConstraint}
                      onValueChange={(value) => handleInputChange("upsellConstraint", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">YES</SelectItem>
                        <SelectItem value="NO">NO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awignSharePercent">
                      Awign Share % <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.awignSharePercent}
                      onValueChange={(value) => handleInputChange("awignSharePercent", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select share" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Below 70%">Below 70%</SelectItem>
                        <SelectItem value="70% & Above">70% & Above</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upsellConstraintType">
                      Upsell Constraint Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.upsellConstraintType}
                      onValueChange={(value) => handleInputChange("upsellConstraintType", value)}
                      required
                      disabled={!formData.upsellConstraint || formData.upsellConstraint === "NO"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.upsellConstraint === "NO" ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Not applicable
                          </div>
                        ) : formData.upsellConstraint === "YES" ? (
                          getUpsellConstraintTypes(formData.upsellConstraint).length > 0 ? (
                            getUpsellConstraintTypes(formData.upsellConstraint).map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No types available
                            </div>
                          )
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Select Upsell Constraint first
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                    <div className="space-y-2">
                      <Label htmlFor="retentionType">Retention Type</Label>
                      <Input
                        id="retentionType"
                        value={formData.retentionType}
                        placeholder="Auto"
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  {formData.upsellConstraint === "YES" && (
                    <>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="upsellConstraintSub">
                          Upsell Constraint Type - Sub <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={formData.upsellConstraintSub}
                          onValueChange={(value) => handleInputChange("upsellConstraintSub", value)}
                          required
                          disabled={!formData.upsellConstraint || formData.upsellConstraint === "NO" || !formData.upsellConstraintType || formData.upsellConstraintType === "-"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {formData.upsellConstraint === "NO" ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                Not applicable
                              </div>
                            ) : formData.upsellConstraint === "YES" && formData.upsellConstraintType ? (
                              getUpsellConstraintSubs(formData.upsellConstraint, formData.upsellConstraintType).length > 0 ? (
                                getUpsellConstraintSubs(formData.upsellConstraint, formData.upsellConstraintType).map((sub) => (
                                  <SelectItem key={sub} value={sub}>
                                    {sub}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No sub types available
                                </div>
                              )
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                {!formData.upsellConstraint ? "Select Upsell Constraint first" : "Select Type first"}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="upsellConstraintSub2">
                          Upsell Constraint Type - Sub 2 <span className="text-destructive">*</span>
                        </Label>
                        {isReadOnlySub2(formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub) ? (
                          <Input
                            id="upsellConstraintSub2"
                            value="-"
                            readOnly
                            className="bg-muted"
                          />
                        ) : isFreeTextSub2(formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub) ? (
                          <Input
                            id="upsellConstraintSub2"
                            value={formData.upsellConstraintSub2 === "-" ? "" : formData.upsellConstraintSub2}
                            onChange={(e) => handleInputChange("upsellConstraintSub2", e.target.value)}
                            placeholder="Enter details (free text)"
                            required
                            disabled={!formData.upsellConstraintSub || formData.upsellConstraintSub === "-"}
                          />
                        ) : (
                          <Select
                            value={formData.upsellConstraintSub2}
                            onValueChange={(value) => handleInputChange("upsellConstraintSub2", value)}
                            required
                            disabled={!formData.upsellConstraint || formData.upsellConstraint === "NO" || !formData.upsellConstraintType || formData.upsellConstraintType === "-" || !formData.upsellConstraintSub || formData.upsellConstraintSub === "-" || getUpsellConstraintSub2s(formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub).length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {formData.upsellConstraint === "YES" && formData.upsellConstraintType && formData.upsellConstraintSub ? (
                                getUpsellConstraintSub2s(formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub).length > 0 ? (
                                  getUpsellConstraintSub2s(formData.upsellConstraint, formData.upsellConstraintType, formData.upsellConstraintSub).map((sub2) => (
                                    <SelectItem key={sub2} value={sub2}>
                                      {sub2}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No options available
                                  </div>
                                )
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  {!formData.upsellConstraint ? "Select Upsell Constraint first" : !formData.upsellConstraintType ? "Select Type first" : "Select Sub first"}
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </>
                  )}
                  </div>
                </CardContent>
              </Card>

              {/* 5th Section: Upsell Action Status */}
              <Card className="border-teal-200 bg-teal-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-teal-900">Upsell Action Status</h3>
                  <div className="max-w-md">
                    <Select
                      value={formData.upsellActionStatus}
                      onValueChange={(value) => handleInputChange("upsellActionStatus", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Started">Not Started</SelectItem>
                        <SelectItem value="Ongoing">Ongoing</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Mandate"}
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* View Mandates Table */}
      {viewMode === "view" && (
        <>
          {/* Filters */}
      <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4">Filters</h3>
              <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
              <Input
                  placeholder="Search all fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                    className={`text-left ${searchTerm ? "border-blue-500 bg-blue-50/50" : ""}`}
              />
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className={`text-left ${filterAccount !== "all" ? "border-blue-500 bg-blue-50/50" : ""}`}>
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterKam} onValueChange={setFilterKam}>
                    <SelectTrigger className={`text-left ${filterKam !== "all" ? "border-blue-500 bg-blue-50/50" : ""}`}>
                    <SelectValue placeholder="All KAMs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All KAMs</SelectItem>
                    {kams.map((kam) => (
                      <SelectItem key={kam.id} value={kam.id}>
                        {kam.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterLob} onValueChange={setFilterLob}>
                    <SelectTrigger className={`text-left ${filterLob !== "all" ? "border-blue-500 bg-blue-50/50" : ""}`}>
                    <SelectValue placeholder="All LoB" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All LoB</SelectItem>
                    {availableLobs.map((lob) => (
                      <SelectItem key={lob} value={lob}>
                        {lob}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterMandateHealth} onValueChange={setFilterMandateHealth}>
                    <SelectTrigger className={`text-left ${filterMandateHealth !== "all" ? "border-blue-500 bg-blue-50/50" : ""}`}>
                    <SelectValue placeholder="All Mandate Health" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Mandate Health</SelectItem>
                    <SelectItem value="Exceeds Expectations">Exceeds Expectations</SelectItem>
                    <SelectItem value="Meets Expectations">Meets Expectations</SelectItem>
                    <SelectItem value="Need Improvement">Need Improvement</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterUpsellStatus} onValueChange={setFilterUpsellStatus}>
                    <SelectTrigger className={`text-left ${filterUpsellStatus !== "all" ? "border-blue-500 bg-blue-50/50" : ""}`}>
                    <SelectValue placeholder="All Upsell Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Upsell Status</SelectItem>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                    <SelectItem value="Done">Done</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterRetentionType} onValueChange={setFilterRetentionType}>
                    <SelectTrigger className={`text-left ${filterRetentionType !== "all" ? "border-blue-500 bg-blue-50/50" : ""}`}>
                    <SelectValue placeholder="All Retention Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Retention Types</SelectItem>
                    {availableRetentionTypes.map((retentionType) => (
                      <SelectItem key={retentionType} value={retentionType}>
                        {retentionType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
                <div className="flex justify-end">
                  <Button
                    className="bg-black text-white hover:bg-black/90"
                    onClick={clearFilters}
                  >
                  Clear Filters
                </Button>
                </div>
            </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                      <TableHead>Project Code</TableHead>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>KAM</TableHead>
                      <TableHead>LoB</TableHead>
                      <TableHead>ACV</TableHead>
                      <TableHead>MCV</TableHead>
                      <TableHead>Mandate Health</TableHead>
                      <TableHead>Upsell Status</TableHead>
                      <TableHead>Retention Type</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                    {loadingMandates ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground">Loading mandates...</span>
                    </div>
                  </TableCell>
                      </TableRow>
                    ) : filteredMandates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          No mandates found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMandates.map((mandate) => (
                <TableRow key={mandate.id}>
                          <TableCell className="font-medium"><HighlightedText text={mandate.projectCode} searchTerm={searchTerm} /></TableCell>
                          <TableCell><HighlightedText text={mandate.projectName} searchTerm={searchTerm} /></TableCell>
                          <TableCell><HighlightedText text={mandate.account} searchTerm={searchTerm} /></TableCell>
                          <TableCell><HighlightedText text={mandate.kam} searchTerm={searchTerm} /></TableCell>
                          <TableCell><HighlightedText text={mandate.lob} searchTerm={searchTerm} /></TableCell>
                          <TableCell><HighlightedText text={mandate.acv} searchTerm={searchTerm} /></TableCell>
                          <TableCell><HighlightedText text={mandate.mcv} searchTerm={searchTerm} /></TableCell>
                  <TableCell>
                            <Badge
                              variant={
                                mandate.mandateHealth === "Exceeds Expectations"
                                  ? "default"
                                  : mandate.mandateHealth === "Meets Expectations"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              <HighlightedText text={mandate.mandateHealth} searchTerm={searchTerm} />
                    </Badge>
                  </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                mandate.upsellStatus === "Done"
                                  ? "default"
                                  : mandate.upsellStatus === "Ongoing"
                                    ? "secondary"
                                    : "destructive"
                              }
                              className={
                                mandate.upsellStatus === "Done"
                                  ? "bg-green-500 hover:bg-green-600 text-white"
                                  : mandate.upsellStatus === "Ongoing"
                                    ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                    : ""
                              }
                            >
                              <HighlightedText text={mandate.upsellStatus} searchTerm={searchTerm} />
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <HighlightedText text={mandate.retentionType} searchTerm={searchTerm} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewDetails(mandate)}
                                className="border-black"
                              >
                                View Details
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => {
                                  setMandateForUpdate(mandate);
                                  setUpdateOptionsDialogOpen(true);
                                }}
                                className="bg-blue-500 hover:bg-blue-600 text-white"
                              >
                                Update
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setMandateToDelete(mandate);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                </TableRow>
                      ))
                    )}
            </TableBody>
          </Table>
              </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={(open) => {
        setDetailsModalOpen(open);
        if (!open) {
          setIsEditMode(false);
          setIsMandateCheckerEditMode(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMandate?.project_name || "Mandate Details"}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 mb-4">
            {!isEditMode ? (
              <Button variant="outline" onClick={() => setIsEditMode(true)}>
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => {
                  setIsEditMode(false);
                  setEditMandateData({
                    projectCode: selectedMandate.project_code || "",
                    projectName: selectedMandate.project_name || "",
                    accountId: selectedMandate.account_id || "",
                    kamId: selectedMandate.kam_id || "",
                    lob: selectedMandate.lob || "",
                    newSalesOwner: selectedMandate.new_sales_owner || "",
                    handoverMonthlyVolume: selectedMandate.handover_monthly_volume?.toString() || "",
                    handoverCommercialPerHead: selectedMandate.handover_commercial_per_head?.toString() || "",
                    handoverMcv: selectedMandate.handover_mcv?.toString() || "",
                    prjDurationMonths: selectedMandate.prj_duration_months?.toString() || "",
                    handoverAcv: selectedMandate.handover_acv?.toString() || "",
                    handoverPrjType: selectedMandate.handover_prj_type || "",
                    revenueMonthlyVolume: selectedMandate.revenue_monthly_volume?.toString() || "",
                    revenueCommercialPerHead: selectedMandate.revenue_commercial_per_head?.toString() || "",
                    revenueMcv: selectedMandate.revenue_mcv?.toString() || "",
                    revenueAcv: selectedMandate.revenue_acv?.toString() || "",
                    revenuePrjType: selectedMandate.revenue_prj_type || "",
                    mandateHealth: selectedMandate.mandate_health || "",
                    upsellConstraint: selectedMandate.upsell_constraint ? "YES" : "NO",
                    upsellConstraintType: selectedMandate.upsell_constraint_type || "",
                    upsellConstraintSub: selectedMandate.upsell_constraint_sub || "",
                    upsellConstraintSub2: selectedMandate.upsell_constraint_sub2 || "",
                    clientBudgetTrend: selectedMandate.client_budget_trend || "",
                    awignSharePercent: selectedMandate.awign_share_percent || "",
                    retentionType: selectedMandate.retention_type || "",
                    upsellActionStatus: selectedMandate.upsell_action_status || "",
                  });
                }}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateMandate} disabled={updatingMandate}>
                  {updatingMandate ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            )}
          </div>
          {selectedMandate && editMandateData && (
            <div className="space-y-6">
              {/* 1st Section: Project Info */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">Project Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Project Code:</Label>
                      {isEditMode ? (
                        <Input
                          value={editMandateData.projectCode}
                          onChange={(e) => setEditMandateData({ ...editMandateData, projectCode: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.project_code || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Project Name:</Label>
                      {isEditMode ? (
                        <Input
                          value={editMandateData.projectName}
                          onChange={(e) => setEditMandateData({ ...editMandateData, projectName: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.project_name || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Account Name:</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.accountId}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, accountId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                placeholder="Search accounts..."
                                value={editAccountSearch}
                                onChange={(e) => setEditAccountSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8"
                              />
                            </div>
                            {accounts
                              .filter((account) =>
                                account.name.toLowerCase().includes(editAccountSearch.toLowerCase())
                              )
                              .map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.name}
                                </SelectItem>
                              ))}
                            {accounts.filter((account) =>
                              account.name.toLowerCase().includes(editAccountSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No accounts found
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.account || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">KAM (CE in charge):</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.kamId}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, kamId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select KAM" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                placeholder="Search KAMs..."
                                value={editKamSearch}
                                onChange={(e) => setEditKamSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8"
                              />
                            </div>
                            {kams
                              .filter((kam) =>
                                (kam.full_name || "Unknown").toLowerCase().includes(editKamSearch.toLowerCase())
                              )
                              .map((kam) => (
                                <SelectItem key={kam.id} value={kam.id}>
                                  {kam.full_name || "Unknown"}
                                </SelectItem>
                              ))}
                            {kams.filter((kam) =>
                              (kam.full_name || "Unknown").toLowerCase().includes(editKamSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No KAMs found
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.kam || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">LoB (Vertical):</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.lob}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, lob: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select LoB" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Diligence & Audit">Diligence & Audit</SelectItem>
                            <SelectItem value="New Business Development">New Business Development</SelectItem>
                            <SelectItem value="Digital Gigs">Digital Gigs</SelectItem>
                            <SelectItem value="Awign Expert">Awign Expert</SelectItem>
                            <SelectItem value="Last Mile Operations">Last Mile Operations</SelectItem>
                            <SelectItem value="Invigilation & Proctoring">Invigilation & Proctoring</SelectItem>
                            <SelectItem value="Staffing">Staffing</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.lob || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Use Case:</Label>
                      {isEditMode ? (
                        editMandateData.lob && hasOnlyDashUseCase(editMandateData.lob) ? (
                          <Input
                            value="-"
                            readOnly
                            className="bg-muted"
                          />
                        ) : (
                          <Select
                            value={editMandateData.useCase}
                            onValueChange={(value) => setEditMandateData({ ...editMandateData, useCase: value })}
                            disabled={!editMandateData.lob || hasOnlyDashUseCase(editMandateData.lob)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Use Case" />
                            </SelectTrigger>
                            <SelectContent>
                              {editMandateData.lob ? (
                                getUseCasesForLob(editMandateData.lob).length > 0 ? (
                                  getUseCasesForLob(editMandateData.lob).map((useCase) => (
                                    <SelectItem key={useCase} value={useCase}>
                                      {useCase}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No use cases available
                                  </div>
                                )
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  Select LoB first
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        )
                      ) : (
                        <p className="mt-1">{selectedMandate.use_case || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Sub Use Case:</Label>
                      {isEditMode ? (
                        editMandateData.lob && editMandateData.useCase && hasOnlyDashSubUseCase(editMandateData.lob, editMandateData.useCase) ? (
                          <Input
                            value="-"
                            readOnly
                            className="bg-muted"
                          />
                        ) : (
                          <Select
                            value={editMandateData.subUseCase}
                            onValueChange={(value) => setEditMandateData({ ...editMandateData, subUseCase: value })}
                            disabled={!editMandateData.lob || !editMandateData.useCase || hasOnlyDashSubUseCase(editMandateData.lob, editMandateData.useCase)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Sub Use Case" />
                            </SelectTrigger>
                            <SelectContent>
                              {editMandateData.lob && editMandateData.useCase ? (
                                getSubUseCasesForUseCase(editMandateData.lob, editMandateData.useCase).length > 0 ? (
                                  getSubUseCasesForUseCase(editMandateData.lob, editMandateData.useCase).map((subUseCase) => (
                                    <SelectItem key={subUseCase} value={subUseCase}>
                                      {subUseCase}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No sub use cases available
                                  </div>
                                )
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  {!editMandateData.lob ? "Select LoB first" : "Select Use Case first"}
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        )
                      ) : (
                        <p className="mt-1">{selectedMandate.sub_use_case || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Type:</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.type}
                          onValueChange={(value) => {
                            const updated = { ...editMandateData, type: value };
                            // If type is changed to "New Cross Sell", clear all handover values
                            if (value === "New Cross Sell") {
                              updated.newSalesOwner = "";
                              updated.handoverMonthlyVolume = "";
                              updated.handoverCommercialPerHead = "";
                              updated.handoverMcv = "";
                              updated.prjDurationMonths = "";
                              updated.handoverAcv = "";
                              updated.handoverPrjType = "";
                            }
                            setEditMandateData(updated);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="New Acquisition">New Acquisition</SelectItem>
                            <SelectItem value="New Cross Sell">New Cross Sell</SelectItem>
                            <SelectItem value="Existing">Existing</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.type || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Section: Handover Info */}
              {((isEditMode && (editMandateData.type === "New Acquisition" || editMandateData.type === "Existing")) || 
                (!isEditMode && (selectedMandate.type === "New Acquisition" || selectedMandate.type === "Existing"))) && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Handover Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">New Sales Owner:</Label>
                      {isEditMode ? (
                        <Input
                          value={editMandateData.newSalesOwner}
                          onChange={(e) => setEditMandateData({ ...editMandateData, newSalesOwner: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.new_sales_owner || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">MCV:</Label>
                      {isEditMode ? (
                        <Input
                          value={editMandateData.handoverMcv}
                          placeholder="Auto"
                          readOnly
                          className="bg-muted"
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.handover_mcv ? selectedMandate.handover_mcv.toLocaleString("en-IN") : "N/A"}</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-2">
                          <Label className="font-medium text-muted-foreground">Monthly Volume:</Label>
                          {isEditMode ? (
                            <Input
                              type="number"
                              value={editMandateData.handoverMonthlyVolume}
                              onChange={(e) => setEditMandateData({ ...editMandateData, handoverMonthlyVolume: e.target.value })}
                            />
                          ) : (
                            <p className="mt-1">{selectedMandate.handover_monthly_volume ? selectedMandate.handover_monthly_volume.toLocaleString("en-IN") : "N/A"}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="font-medium text-muted-foreground">Commercial per head/task:</Label>
                          {isEditMode ? (
                            <Input
                              type="number"
                              value={editMandateData.handoverCommercialPerHead}
                              onChange={(e) => setEditMandateData({ ...editMandateData, handoverCommercialPerHead: e.target.value })}
                            />
                          ) : (
                            <p className="mt-1">{selectedMandate.handover_commercial_per_head ? selectedMandate.handover_commercial_per_head.toLocaleString("en-IN") : "N/A"}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">PRJ duration in months:</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.prjDurationMonths}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, prjDurationMonths: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select months (1-12)" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                              <SelectItem key={month} value={month.toString()}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.prj_duration_months || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">ACV:</Label>
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={editMandateData.handoverAcv}
                          onChange={(e) => setEditMandateData({ ...editMandateData, handoverAcv: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.handover_acv ? selectedMandate.handover_acv.toLocaleString("en-IN") : "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">PRJ Type:</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.handoverPrjType}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, handoverPrjType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Recurring">Recurring</SelectItem>
                            <SelectItem value="One-time">One-time</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.handover_prj_type || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* 3rd Section: Revenue Info */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Revenue Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">MCV:</Label>
                      {isEditMode ? (
                        <Input
                          value={editMandateData.revenueMcv}
                          placeholder="Auto"
                          readOnly
                          className="bg-muted"
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.revenue_mcv ? selectedMandate.revenue_mcv.toLocaleString("en-IN") : "N/A"}</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-2">
                          <Label className="font-medium text-muted-foreground">Monthly Volume:</Label>
                          {isEditMode ? (
                            <Input
                              type="number"
                              value={editMandateData.revenueMonthlyVolume}
                              onChange={(e) => setEditMandateData({ ...editMandateData, revenueMonthlyVolume: e.target.value })}
                            />
                          ) : (
                            <p className="mt-1">{selectedMandate.revenue_monthly_volume ? selectedMandate.revenue_monthly_volume.toLocaleString("en-IN") : "N/A"}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="font-medium text-muted-foreground">Commercial per head/task:</Label>
                          {isEditMode ? (
                            <Input
                              type="number"
                              value={editMandateData.revenueCommercialPerHead}
                              onChange={(e) => setEditMandateData({ ...editMandateData, revenueCommercialPerHead: e.target.value })}
                            />
                          ) : (
                            <p className="mt-1">{selectedMandate.revenue_commercial_per_head ? selectedMandate.revenue_commercial_per_head.toLocaleString("en-IN") : "N/A"}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">ACV:</Label>
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={editMandateData.revenueAcv}
                          onChange={(e) => setEditMandateData({ ...editMandateData, revenueAcv: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.revenue_acv ? selectedMandate.revenue_acv.toLocaleString("en-IN") : "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">PRJ Type:</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.revenuePrjType}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, revenuePrjType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Recurring">Recurring</SelectItem>
                            <SelectItem value="One-time">One-time</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.revenue_prj_type || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4th Section: Mandate Checker */}
              <Card id="mandate-checker-section" className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-orange-900">Mandate Checker</h3>
                    {isMandateCheckerEditMode && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setIsMandateCheckerEditMode(false);
                          setEditMandateData({
                            ...editMandateData,
                            mandateHealth: selectedMandate.mandate_health || "",
                            upsellConstraint: selectedMandate.upsell_constraint ? "YES" : "NO",
                            upsellConstraintType: selectedMandate.upsell_constraint_type || "",
                            upsellConstraintSub: selectedMandate.upsell_constraint_sub || "",
                            upsellConstraintSub2: selectedMandate.upsell_constraint_sub2 || "",
                            clientBudgetTrend: selectedMandate.client_budget_trend || "",
                            awignSharePercent: selectedMandate.awign_share_percent || "",
                            retentionType: selectedMandate.retention_type || "",
                          });
                        }}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleUpdateMandateChecker} disabled={updatingMandateChecker}>
                          {updatingMandateChecker ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Mandate Health:</Label>
                      {(isEditMode || isMandateCheckerEditMode) ? (
                        <Select
                          value={editMandateData.mandateHealth}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, mandateHealth: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select health" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Exceeds Expectations">Exceeds Expectations</SelectItem>
                            <SelectItem value="Meets Expectations">Meets Expectations</SelectItem>
                            <SelectItem value="Need Improvement">Need Improvement</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.mandate_health || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Upsell Constraint:</Label>
                      {(isEditMode || isMandateCheckerEditMode) ? (
                        <Select
                          value={editMandateData.upsellConstraint}
                          onValueChange={(value) => {
                            if (value === "NO") {
                              setEditMandateData({ ...editMandateData, upsellConstraint: value, upsellConstraintType: "-", upsellConstraintSub: "-", upsellConstraintSub2: "-" });
                            } else {
                              setEditMandateData({ ...editMandateData, upsellConstraint: value, upsellConstraintType: "", upsellConstraintSub: "", upsellConstraintSub2: "" });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="YES">YES</SelectItem>
                            <SelectItem value="NO">NO</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.upsell_constraint ? "YES" : selectedMandate.upsell_constraint === false ? "NO" : "N/A"}</p>
                      )}
                    </div>
                    {/* Always show Upsell Constraint Type fields - always visible in view mode, conditionally enabled in edit mode */}
                    <>
                      <div className="space-y-2">
                        <Label className="font-medium text-muted-foreground">Upsell Constraint Type:</Label>
                        {(isEditMode || isMandateCheckerEditMode) ? (
                          <Select
                            value={editMandateData.upsellConstraintType}
                            onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellConstraintType: value, upsellConstraintSub: "", upsellConstraintSub2: "" })}
                            disabled={!editMandateData.upsellConstraint || editMandateData.upsellConstraint !== "YES"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {editMandateData.upsellConstraint === "NO" ? (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  Not applicable
                                </div>
                              ) : editMandateData.upsellConstraint === "YES" ? (
                                getUpsellConstraintTypes(editMandateData.upsellConstraint).length > 0 ? (
                                  getUpsellConstraintTypes(editMandateData.upsellConstraint).map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No types available
                                  </div>
                                )
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  Select Upsell Constraint first
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="mt-1">{selectedMandate.upsell_constraint_type || "N/A"}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-muted-foreground">Upsell Constraint Type - Sub:</Label>
                        {(isEditMode || isMandateCheckerEditMode) ? (
                          <Select
                            value={editMandateData.upsellConstraintSub}
                            onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellConstraintSub: value, upsellConstraintSub2: "" })}
                            disabled={!editMandateData.upsellConstraint || editMandateData.upsellConstraint === "NO" || !editMandateData.upsellConstraintType || editMandateData.upsellConstraintType === "-"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {editMandateData.upsellConstraint === "NO" ? (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  Not applicable
                                </div>
                              ) : editMandateData.upsellConstraint === "YES" && editMandateData.upsellConstraintType ? (
                                getUpsellConstraintSubs(editMandateData.upsellConstraint, editMandateData.upsellConstraintType).length > 0 ? (
                                  getUpsellConstraintSubs(editMandateData.upsellConstraint, editMandateData.upsellConstraintType).map((sub) => (
                                    <SelectItem key={sub} value={sub}>
                                      {sub}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No sub types available
                                  </div>
                                )
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  {!editMandateData.upsellConstraint ? "Select Upsell Constraint first" : "Select Type first"}
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="mt-1">{selectedMandate.upsell_constraint_sub || "N/A"}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-muted-foreground">Upsell Constraint Type - Sub 2:</Label>
                        {(isEditMode || isMandateCheckerEditMode) ? (
                          editMandateData.upsellConstraint === "NO" ? (
                            <Input
                              value="-"
                              readOnly
                              className="bg-muted"
                            />
                          ) : isReadOnlySub2(editMandateData.upsellConstraint, editMandateData.upsellConstraintType, editMandateData.upsellConstraintSub) ? (
                            <Input
                              value="-"
                              readOnly
                              className="bg-muted"
                            />
                          ) : isFreeTextSub2(editMandateData.upsellConstraint, editMandateData.upsellConstraintType, editMandateData.upsellConstraintSub) ? (
                            <Input
                              value={editMandateData.upsellConstraintSub2 === "-" ? "" : editMandateData.upsellConstraintSub2}
                              onChange={(e) => setEditMandateData({ ...editMandateData, upsellConstraintSub2: e.target.value })}
                              placeholder="Enter details (free text)"
                              disabled={!editMandateData.upsellConstraintSub || editMandateData.upsellConstraintSub === "-"}
                            />
                          ) : (
                            <Select
                              value={editMandateData.upsellConstraintSub2}
                              onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellConstraintSub2: value })}
                              disabled={!editMandateData.upsellConstraint || editMandateData.upsellConstraint === "NO" || !editMandateData.upsellConstraintType || editMandateData.upsellConstraintType === "-" || !editMandateData.upsellConstraintSub || editMandateData.upsellConstraintSub === "-" || getUpsellConstraintSub2s(editMandateData.upsellConstraint, editMandateData.upsellConstraintType, editMandateData.upsellConstraintSub).length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {editMandateData.upsellConstraint === "YES" && editMandateData.upsellConstraintType && editMandateData.upsellConstraintSub ? (
                                  getUpsellConstraintSub2s(editMandateData.upsellConstraint, editMandateData.upsellConstraintType, editMandateData.upsellConstraintSub).length > 0 ? (
                                    getUpsellConstraintSub2s(editMandateData.upsellConstraint, editMandateData.upsellConstraintType, editMandateData.upsellConstraintSub).map((sub2) => (
                                      <SelectItem key={sub2} value={sub2}>
                                        {sub2}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      No options available
                                    </div>
                                  )
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    {!editMandateData.upsellConstraint ? "Select Upsell Constraint first" : !editMandateData.upsellConstraintType ? "Select Type first" : "Select Sub first"}
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          )
                        ) : (
                          <p className="mt-1">{selectedMandate.upsell_constraint_sub2 || "N/A"}</p>
                        )}
                      </div>
                    </>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Client Budget Trend:</Label>
                      {(isEditMode || isMandateCheckerEditMode) ? (
                        <Select
                          value={editMandateData.clientBudgetTrend}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, clientBudgetTrend: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select trend" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Increase">Increase</SelectItem>
                            <SelectItem value="Same">Same</SelectItem>
                            <SelectItem value="Decrease">Decrease</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.client_budget_trend || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Awign Share %:</Label>
                      {(isEditMode || isMandateCheckerEditMode) ? (
                        <Select
                          value={editMandateData.awignSharePercent}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, awignSharePercent: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select share" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Below 70%">Below 70%</SelectItem>
                            <SelectItem value="70% & Above">70% & Above</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.awign_share_percent || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Retention Type:</Label>
                      {(isEditMode || isMandateCheckerEditMode) ? (
                        <Input
                          value={editMandateData.retentionType}
                          placeholder="Auto"
                          readOnly
                          className="bg-muted"
                        />
                      ) : (
                        <p className="mt-1">{selectedMandate.retention_type || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5th Section: Upsell Action Status */}
              <Card className="border-teal-200 bg-teal-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-teal-900">Upsell Action Status</h3>
                  <div className="max-w-md">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Upsell Action Status:</Label>
                      {isEditMode ? (
                        <Select
                          value={editMandateData.upsellActionStatus}
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellActionStatus: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Started">Not Started</SelectItem>
                            <SelectItem value="Ongoing">Ongoing</SelectItem>
                            <SelectItem value="Done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedMandate.upsell_action_status || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5th Section: Monthly Records */}
              {selectedMandate?.monthly_data && Object.keys(selectedMandate.monthly_data).length > 0 && (() => {
                // Group monthly records by financial year
                const recordsByFinancialYear: Record<string, Array<{ monthYear: string; monthName: string; achievedMcv: number }>> = {};
                
                Object.entries(selectedMandate.monthly_data)
                  .sort(([a], [b]) => a.localeCompare(b)) // Sort ascending by date (oldest first)
                  .forEach(([monthYear, value]: [string, any]) => {
                    // Handle both old format (array) and new format (number)
                    let achievedMcv = 0;
                    if (Array.isArray(value) && value.length >= 2) {
                      // Old format: [plannedMcv, achievedMcv]
                      achievedMcv = parseFloat(value[1]?.toString() || "0") || 0;
                    } else if (typeof value === 'number') {
                      // New format: just achievedMcv
                      achievedMcv = value;
                    }
                    
                    // Parse month_year to display format
                    const [year, month] = monthYear.split('-');
                    const yearNum = parseInt(year);
                    const monthNum = parseInt(month);
                    const monthName = new Date(yearNum, monthNum - 1, 1).toLocaleString('default', { month: 'long' });
                    const financialYear = calculateFinancialYear(monthNum, yearNum);
                    
                    if (!recordsByFinancialYear[financialYear]) {
                      recordsByFinancialYear[financialYear] = [];
                    }
                    
                    recordsByFinancialYear[financialYear].push({
                      monthYear,
                      monthName,
                      achievedMcv,
                    });
                  });
                
                // Sort financial years (extract start year for sorting)
                const sortedFinancialYears = Object.keys(recordsByFinancialYear).sort((a, b) => {
                  const yearA = parseInt(a.split('-')[0]);
                  const yearB = parseInt(b.split('-')[0]);
                  return yearA - yearB;
                });
                
                return (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-purple-900">Monthly Records</h3>
                    {sortedFinancialYears.map((financialYear) => (
                      <Card key={financialYear} className="border-purple-200 bg-purple-50/50">
                        <CardContent className="pt-6">
                          <h4 className="font-semibold text-md mb-4 text-purple-800">Financial Year: {financialYear}</h4>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Month</TableHead>
                                  <TableHead>Achieved MCV</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recordsByFinancialYear[financialYear].map((record) => (
                                  <TableRow key={record.monthYear}>
                                    <TableCell className="font-medium">
                                      {record.monthName}
                                    </TableCell>
                                    <TableCell>
                                      {record.achievedMcv ? record.achievedMcv.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Preview Dialog */}
      <CSVPreviewDialog
        open={csvPreviewOpen}
        onOpenChange={setCsvPreviewOpen}
        rows={csvPreviewRows}
        onConfirm={handleConfirmUpload}
        onCancel={handleCancelUpload}
        loading={loadingMandates}
        title="Preview Mandates CSV Upload"
      />

      {/* Update Options Dialog */}
      <Dialog open={updateOptionsDialogOpen} onOpenChange={setUpdateOptionsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Update Option</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-6"
              onClick={() => {
                if (mandateForUpdate) {
                  handleViewDetails(mandateForUpdate);
                  setUpdateOptionsDialogOpen(false);
                  setDetailsModalOpen(true);
                  // Enable edit mode for mandate checker
                  setIsMandateCheckerEditMode(true);
                  // Scroll to mandate checker section after dialog opens
                  setTimeout(() => {
                    const mandateCheckerCard = document.getElementById('mandate-checker-section');
                    if (mandateCheckerCard) {
                      mandateCheckerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 300);
                }
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Mandate Checker</div>
                <div className="text-sm text-muted-foreground">Update mandate checker information</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-6"
              onClick={async () => {
                setUpdateOptionsDialogOpen(false);
                
                // Fetch latest mandate data to ensure we have up-to-date monthly_data
                if (mandateForUpdate) {
                  try {
                    const { data: updatedMandate, error } = await supabase
                      .from("mandates")
                      .select("*")
                      .eq("id", mandateForUpdate.id)
                      .single();
                    
                    if (!error && updatedMandate) {
                      setMandateForUpdate(updatedMandate);
                    }
                  } catch (error) {
                    console.error("Error fetching latest mandate data:", error);
                  }
                }
                
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;
                setMonthlyRecordForm({
                  month: "",
                  year: currentYear.toString(),
                  financialYear: "",
                  achievedMcv: "",
                });
                setMonthlyRecordDialogOpen(true);
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Mandate Monthly Record</div>
                <div className="text-sm text-muted-foreground">Add or update monthly MCV records</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Monthly Record Dialog */}
      <Dialog open={monthlyRecordDialogOpen} onOpenChange={async (open) => {
        setMonthlyRecordDialogOpen(open);
        if (!open) {
          setMonthlyRecordForm({
            month: "",
            year: "",
            financialYear: "",
            achievedMcv: "",
          });
        } else {
          // Fetch latest mandate data when dialog opens to ensure we have up-to-date monthly_data
          if (mandateForUpdate) {
            try {
              const { data: updatedMandate, error } = await supabase
                .from("mandates")
                .select("*")
                .eq("id", mandateForUpdate.id)
                .single();
              
              if (!error && updatedMandate) {
                setMandateForUpdate(updatedMandate);
              }
            } catch (error) {
              console.error("Error fetching latest mandate data:", error);
            }
          }
          
          // Auto-fill year when dialog opens
          const now = new Date();
          const currentYear = now.getFullYear();
          setMonthlyRecordForm(prev => ({
            ...prev,
            year: prev.year || currentYear.toString(),
          }));
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Monthly Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!mandateForUpdate) return;

            setSavingMonthlyRecord(true);
            try {
              const month = parseInt(monthlyRecordForm.month);
              const year = parseInt(monthlyRecordForm.year);
              const achievedMcv = parseFloat(monthlyRecordForm.achievedMcv);

              if (!month || !year || isNaN(achievedMcv)) {
                toast({
                  title: "Validation Error",
                  description: "Please fill in all fields with valid values.",
                  variant: "destructive",
                });
                setSavingMonthlyRecord(false);
                return;
              }

              const monthYear = `${year}-${String(month).padStart(2, '0')}`;
              
              // Fetch current monthly_data
              const { data: currentMandate, error: fetchError } = await supabase
                .from("mandates")
                .select("monthly_data")
                .eq("id", mandateForUpdate.id)
                .single();

              if (fetchError) throw fetchError;

              // Update or create monthly_data
              // Store only achieved MCV (not planned)
              const currentData = currentMandate?.monthly_data || {};
              const updatedData = {
                ...currentData,
                [monthYear]: achievedMcv,
              };

              const { error: updateError } = await supabase
                .from("mandates")
                .update({ monthly_data: updatedData })
                .eq("id", mandateForUpdate.id);

              if (updateError) throw updateError;

              toast({
                title: "Success!",
                description: "Monthly record saved successfully.",
              });

              setMonthlyRecordDialogOpen(false);
              setMonthlyRecordForm({
                month: "",
                year: "",
                financialYear: "",
                plannedMcv: "",
                achievedMcv: "",
              });
              
              // Refresh mandates list
              fetchMandates();
              
              // If view details is open, refresh it
              if (selectedMandate?.id === mandateForUpdate.id) {
                const { data: updatedMandate } = await supabase
                  .from("mandates")
                  .select("*")
                  .eq("id", mandateForUpdate.id)
                  .single();
                if (updatedMandate) {
                  setSelectedMandate(updatedMandate);
                }
              }
            } catch (error: any) {
              console.error("Error saving monthly record:", error);
              toast({
                title: "Error",
                description: error.message || "Failed to save monthly record. Please try again.",
                variant: "destructive",
              });
            } finally {
              setSavingMonthlyRecord(false);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="month">Month <span className="text-destructive">*</span></Label>
              <Select
                value={monthlyRecordForm.month}
                onValueChange={(value) => setMonthlyRecordForm({ ...monthlyRecordForm, month: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year <span className="text-destructive">*</span></Label>
              <Input
                id="year"
                type="number"
                min="2000"
                max="2100"
                value={monthlyRecordForm.year}
                onChange={(e) => setMonthlyRecordForm({ ...monthlyRecordForm, year: e.target.value })}
                placeholder="e.g., 2025"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="financialYear">Financial Year</Label>
              <Input
                id="financialYear"
                type="text"
                value={monthlyRecordForm.financialYear}
                placeholder="e.g., 2025-26"
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="achievedMcv">Achieved MCV <span className="text-destructive">*</span></Label>
              <Input
                id="achievedMcv"
                type="number"
                step="0.01"
                min="0"
                value={monthlyRecordForm.achievedMcv}
                onChange={(e) => setMonthlyRecordForm({ ...monthlyRecordForm, achievedMcv: e.target.value })}
                placeholder="Enter achieved MCV"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMonthlyRecordDialogOpen(false)}
                disabled={savingMonthlyRecord}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingMonthlyRecord}>
                {savingMonthlyRecord ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Update MCV Dialog */}
      <Dialog open={bulkUpdateMcvDialogOpen} onOpenChange={setBulkUpdateMcvDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update MCV</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const templateHeaders = [
                  { key: "project_id", label: "Project Code" },
                  { key: "month", label: "Month" },
                  { key: "year", label: "Year" },
                  { key: "achieved_mcv", label: "Achieved MCV" },
                ];
                downloadCSVTemplate(templateHeaders, "bulk_mcv_update_template.csv");
                toast({
                  title: "Template Downloaded",
                  description: "CSV template for bulk MCV update downloaded. Fill in the data and upload it.",
                });
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Download Template for Bulk MCV
            </Button>
            <label className="block w-full">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleBulkUploadMcv(file);
                  }
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV File
                </span>
              </Button>
            </label>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Mandates Dialog */}
      <Dialog open={bulkUploadCasesDialogOpen} onOpenChange={setBulkUploadCasesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Mandates</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleDownloadMandateTemplate}
            >
              <FileText className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <label className="block w-full">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleBulkUploadMandates(file);
                  }
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                asChild
                disabled={loadingMandates}
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Update Cases
                </span>
              </Button>
            </label>
          </div>
        </DialogContent>
      </Dialog>

      {/* MCV CSV Preview Dialog */}
      <CSVPreviewDialog
        open={mcvCsvPreviewOpen}
        onOpenChange={setMcvCsvPreviewOpen}
        rows={mcvCsvPreviewRows}
        onConfirm={handleConfirmMcvUpload}
        onCancel={() => {
          setMcvCsvPreviewRows([]);
          setMcvCsvFileToUpload(null);
          setMcvCsvPreviewOpen(false);
        }}
        loading={loadingMandates}
        title="Preview MCV Update CSV"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mandate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the mandate "{mandateToDelete?.project_name || mandateToDelete?.projectCode}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMandate}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMandate}
              disabled={deletingMandate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingMandate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
