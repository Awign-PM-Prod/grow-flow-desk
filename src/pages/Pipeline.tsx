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

interface DealFormData {
  salesModuleName: string;
  kamId: string;
  accountId: string;
  spocId: string;
  spoc2Id: string;
  spoc3Id: string;
  lob: string;
  useCase: string;
  subUseCase: string;
  monthlyVolume: string;
  maxMonthlyVolume: string;
  commercialPerHead: string;
  expectedRevenue: string;
  mpv: string;
  maxMpv: string;
  prjDurationMonths: string;
  gmThreshold: string;
  prjFrequency: string;
  status: string;
  prjStartDate: string;
  probability: string;
  // Status-based fields
  discoveryMeetingSlides: string;
  solutionProposalSlides: string;
  ganttChartUrl: string;
  expectedContractSignDate: string;
  finalProposalSlides: string;
  contractSignDate: string;
  signedContractLink: string;
  droppedReason: string;
  droppedReasonOthers: string;
}

interface StatusUpdateFormData {
  newStatus: string;
  discoveryMeetingSlides: string;
  discoveryMeetingSlidesFile: File | null;
  solutionProposalSlides: string;
  solutionProposalSlidesFile: File | null;
  ganttChartUrl: string;
  ganttChartFile: File | null;
  expectedContractSignDate: string;
  finalProposalSlides: string;
  finalProposalSlidesFile: File | null;
  contractSignDate: string;
  signedContractLink: string;
  signedContractFile: File | null;
  droppedReason: string;
  droppedReasonOthers: string;
}

const statusOptions = [
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

const prjDurationOptions = ["1","2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const prjFrequencyOptions = ["One-Time", "Recurring"];

const droppedReasons = [
  "Client Unresponsive",
  "Requirement not feasible",
  "Commercials above Client's Threshold",
  "Others (put details below)",
];

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

// Status order mapping for chronological sorting
const statusOrder: Record<string, number> = {
  "Listed": 1,
  "Pre-Appointment Prep Done": 2,
  "Discovery Meeting Done": 3,
  "Requirement Gathering Done": 4,
  "Solution Proposal Made": 5,
  "SOW Handshake Done": 6,
  "Final Proposal Done": 7,
  "Commercial Agreed": 8,
  "Closed Won": 9,
  "Dropped": 10,
};

// Helper function to get badge styling for each status
// Helper function to format status with number prefix (starting from 0)
const formatStatusWithNumber = (status: string): string => {
  const index = statusOptions.indexOf(status);
  if (index === -1) return status;
  return `${index}. ${status}`;
};

// Helper function to get valid status options based on current status
// Forward: can only go to next sequential status
// Backward: can go to any previous status (excluding current status)
const getValidStatusOptions = (currentStatus: string): string[] => {
  const currentIndex = statusOptions.indexOf(currentStatus);
  if (currentIndex === -1) return statusOptions; // If status not found, show all
  
  // Forward: can only go to next status (currentIndex + 1)
  const forwardOption = currentIndex < statusOptions.length - 1 ? [statusOptions[currentIndex + 1]] : [];
  
  // Backward: can go to any status from 0 to currentIndex - 1 (excluding current)
  const backwardOptions = statusOptions.slice(0, currentIndex);
  
  // Combine and sort by index
  const validOptions = [...forwardOption, ...backwardOptions];
  return validOptions.sort((a, b) => statusOptions.indexOf(a) - statusOptions.indexOf(b));
};

const getStatusBadgeStyle = (status: string): { variant: "default" | "secondary" | "destructive" | "outline"; className?: string } => {
  const statusStyleMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    "Listed": { variant: "outline", className: "bg-gray-100 text-gray-700 border-gray-300" },
    "Pre-Appointment Prep Done": { variant: "outline", className: "bg-blue-100 text-blue-700 border-blue-300" },
    "Discovery Meeting Done": { variant: "outline", className: "bg-cyan-100 text-cyan-700 border-cyan-300" },
    "Requirement Gathering Done": { variant: "outline", className: "bg-teal-100 text-teal-700 border-teal-300" },
    "Solution Proposal Made": { variant: "outline", className: "bg-indigo-100 text-indigo-700 border-indigo-300" },
    "SOW Handshake Done": { variant: "outline", className: "bg-purple-100 text-purple-700 border-purple-300" },
    "Final Proposal Done": { variant: "outline", className: "bg-pink-100 text-pink-700 border-pink-300" },
    "Commercial Agreed": { variant: "outline", className: "bg-orange-100 text-orange-700 border-orange-300" },
    "Closed Won": { variant: "default", className: "bg-green-600 text-white border-green-600" },
    "Dropped": { variant: "destructive", className: "bg-red-600 text-white border-red-600" },
  };

  return statusStyleMap[status] || { variant: "outline", className: "bg-gray-100 text-gray-700 border-gray-300" };
};

export default function Pipeline() {
  const [loading, setLoading] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  const [updatingDeal, setUpdatingDeal] = useState(false);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<{ rowNumber: number; data: Record<string, any>; isValid: boolean; errors: string[] }>>([]);
  const [csvFileToUpload, setCsvFileToUpload] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [kams, setKams] = useState<{ id: string; full_name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string; account_id: string }[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  
  // Status update dialog state
  const [statusUpdateDialogOpen, setStatusUpdateDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [dealForStatusUpdate, setDealForStatusUpdate] = useState<any | null>(null);
  
  // View details dialog state
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [selectedDealForView, setSelectedDealForView] = useState<any | null>(null);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any | null>(null);
  const [deletingDeal, setDeletingDeal] = useState(false);
  
  // Filters for view mode
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterKam, setFilterKam] = useState("all");
  const [filterLob, setFilterLob] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status">("newest");

  // Search terms for dropdowns in forms
  const [accountSearch, setAccountSearch] = useState("");
  const [kamSearch, setKamSearch] = useState("");
  const [spocSearch, setSpocSearch] = useState("");
  const [spoc2Search, setSpoc2Search] = useState("");
  const [spoc3Search, setSpoc3Search] = useState("");

  const [formData, setFormData] = useState<DealFormData>({
    salesModuleName: "",
    kamId: "",
    accountId: "",
    spocId: "",
    spoc2Id: "",
    spoc3Id: "",
    lob: "",
    useCase: "",
    subUseCase: "",
    monthlyVolume: "",
    maxMonthlyVolume: "",
    commercialPerHead: "",
    expectedRevenue: "",
    mpv: "",
    maxMpv: "",
    prjDurationMonths: "",
    gmThreshold: "",
    prjFrequency: "",
    status: "Listed",
    prjStartDate: "",
    probability: "",
    discoveryMeetingSlides: "",
    solutionProposalSlides: "",
    ganttChartUrl: "",
    expectedContractSignDate: "",
    finalProposalSlides: "",
    contractSignDate: "",
    signedContractLink: "",
    droppedReason: "",
    droppedReasonOthers: "",
  });

  const [statusUpdateForm, setStatusUpdateForm] = useState<StatusUpdateFormData>({
    newStatus: "",
    discoveryMeetingSlides: "",
    discoveryMeetingSlidesFile: null,
    solutionProposalSlides: "",
    solutionProposalSlidesFile: null,
    ganttChartUrl: "",
    ganttChartFile: null,
    expectedContractSignDate: "",
    finalProposalSlides: "",
    finalProposalSlidesFile: null,
    contractSignDate: "",
    signedContractLink: "",
    signedContractFile: null,
    droppedReason: "",
    droppedReasonOthers: "",
  });

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
        }

        // Fetch KAMs
        const { data: kamData, error: kamError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "kam")
          .order("full_name");

        if (kamData && !kamError) {
          setKams(kamData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const handleDownloadDealTemplate = () => {
    // Exclude auto-calculated fields: sales_module_name (auto-generated), mpv, max_mpv (calculated from monthly_volume * commercial_per_head)
    // Exclude status field (defaults to "Listed" for new deals)
    const templateHeaders = [
      { key: "kam_name", label: "KAM Name" },
      { key: "account_name", label: "Account Name" },
      { key: "spoc_name", label: "SPOC Name" },
      { key: "spoc2_name", label: "SPOC 2 Name" },
      { key: "spoc3_name", label: "SPOC 3 Name" },
      { key: "lob", label: "LoB" },
      { key: "use_case", label: "Use Case" },
      { key: "sub_use_case", label: "Sub Use Case" },
      { key: "monthly_volume", label: "Monthly Volume" },
      { key: "max_monthly_volume", label: "Max Monthly Volume" },
      { key: "commercial_per_head", label: "Commercial per head/task" },
      { key: "expected_revenue", label: "Expected Revenue" },
      { key: "prj_duration_months", label: "PRJ duration in months" },
      { key: "gm_threshold", label: "GM Threshold" },
      { key: "prj_frequency", label: "PRJ Frequency" },
      { key: "prj_start_date", label: "PRJ Start Date" },
      { key: "probability", label: "Probability" },
    ];
    downloadCSVTemplate(templateHeaders, "pipeline_deals_upload_template.csv");
    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded. Note: If LoB has '-' for Use Case/Sub Use Case, leave those fields blank. Status defaults to 'Listed'.",
    });
  };

  const handleBulkUploadDeals = async (file: File) => {
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

      // Get SPOC names to ID mapping for validation
      const allSpocNames = [
        ...csvData.map((row: any) => row["SPOC Name"]).filter(Boolean),
        ...csvData.map((row: any) => row["SPOC 2 Name"]).filter(Boolean),
        ...csvData.map((row: any) => row["SPOC 3 Name"]).filter(Boolean),
      ];
      const uniqueSpocNames = [...new Set(allSpocNames)];
      
      const { data: contactData } = await supabase
        .from("contacts")
        .select("id, first_name, last_name");

      const spocMap: Record<string, string> = {};
      contactData?.forEach((contact) => {
        const fullName = `${contact.first_name} ${contact.last_name}`;
        spocMap[fullName] = contact.id;
      });

      // Parse and validate each row
      const previewRows = csvData.map((row: any, index: number) => {
        const rowNumber = index + 2; // +2 because CSV has header and is 1-indexed
        const errors: string[] = [];
        const accountName = row["Account Name"];
        const accountId = accountMap[accountName];
        const kamName = row["KAM Name"];
        const kamId = kamMap[kamName];
        const spocName = row["SPOC Name"];
        const spocId = spocMap[spocName];
        const spoc2Name = row["SPOC 2 Name"];
        const spoc2Id = spocMap[spoc2Name];
        const spoc3Name = row["SPOC 3 Name"];
        const spoc3Id = spocMap[spoc3Name];

        // Validate lookup fields
        if (accountName && !accountId) {
          errors.push(`Account "${accountName}" does not exist`);
        }
        if (kamName && !kamId) {
          errors.push(`KAM "${kamName}" does not exist`);
        }
        if (spocName && !spocId) {
          errors.push(`SPOC "${spocName}" does not exist`);
        }
        if (spoc2Name && !spoc2Id) {
          errors.push(`SPOC 2 "${spoc2Name}" does not exist`);
        }
        if (spoc3Name && !spoc3Id) {
          errors.push(`SPOC 3 "${spoc3Name}" does not exist`);
        }

        if (!accountName || accountName.trim() === "") {
          errors.push("Account Name is required");
        }
        if (!kamName || kamName.trim() === "") {
          errors.push("KAM Name is required");
        }
        // Validate LoB
        if (!row["LoB"] || row["LoB"].trim() === "") {
          errors.push("LoB is required");
        } else if (!lobOptions.includes(row["LoB"])) {
          errors.push(`Invalid LoB. Must be one of: ${lobOptions.join(", ")}`);
        } else {
          const selectedLob = row["LoB"];
          const validUseCases = getUseCasesForLob(selectedLob);
          
          // Check if this LoB has "-" as the only use case (meaning no use case needed)
          const hasDashUseCase = validUseCases.includes("-");
          
          if (hasDashUseCase && validUseCases.length === 1) {
            // This LoB has no use cases, so Use Case and Sub Use Case should be blank
            if (row["Use Case"] && row["Use Case"].trim() !== "") {
              errors.push(`Use Case should be blank for LoB "${selectedLob}"`);
            }
            if (row["Sub Use Case"] && row["Sub Use Case"].trim() !== "") {
              errors.push(`Sub Use Case should be blank for LoB "${selectedLob}"`);
            }
          } else {
            // This LoB has use cases, validate them
            if (!row["Use Case"] || row["Use Case"].trim() === "") {
              errors.push("Use Case is required");
            } else if (!validUseCases.includes(row["Use Case"])) {
              errors.push(`Invalid Use Case for LoB "${selectedLob}". Must be one of: ${validUseCases.filter(uc => uc !== "-").join(", ")}`);
            } else {
              const selectedUseCase = row["Use Case"];
              const validSubUseCases = getSubUseCasesForUseCase(selectedLob, selectedUseCase);
              
              // Check if this use case has "-" as the only sub use case (meaning no sub use case needed)
              const hasDashSubUseCase = validSubUseCases.includes("-");
              
              if (hasDashSubUseCase && validSubUseCases.length === 1) {
                // This Use Case has no sub use cases, so Sub Use Case should be blank
                if (row["Sub Use Case"] && row["Sub Use Case"].trim() !== "") {
                  errors.push(`Sub Use Case should be blank for Use Case "${selectedUseCase}"`);
                }
              } else {
                // This Use Case has sub use cases, validate them
                if (!row["Sub Use Case"] || row["Sub Use Case"].trim() === "") {
                  errors.push("Sub Use Case is required");
                } else if (!validSubUseCases.includes(row["Sub Use Case"])) {
                  errors.push(`Invalid Sub Use Case for Use Case "${selectedUseCase}". Must be one of: ${validSubUseCases.filter(suc => suc !== "-").join(", ")}`);
                }
              }
            }
          }
        }
        if (!row["Monthly Volume"] || isNaN(parseFloat(row["Monthly Volume"]))) {
          errors.push("Monthly Volume must be a valid number");
        }
        if (!row["Max Monthly Volume"] || isNaN(parseFloat(row["Max Monthly Volume"]))) {
          errors.push("Max Monthly Volume must be a valid number");
        }
        if (!row["Commercial per head/task"] || isNaN(parseFloat(row["Commercial per head/task"]))) {
          errors.push("Commercial per head/task must be a valid number");
        }
        if (!row["Expected Revenue"] || isNaN(parseFloat(row["Expected Revenue"]))) {
          errors.push("Expected Revenue must be a valid number");
        }
        if (!row["PRJ duration in months"] || isNaN(parseInt(row["PRJ duration in months"]))) {
          errors.push("PRJ duration in months must be a valid number");
        }
        if (!row["PRJ Frequency"] || row["PRJ Frequency"].trim() === "") {
          errors.push("PRJ Frequency is required");
        }
        // Status is not required - defaults to "Listed"
        if (!row["PRJ Start Date"] || row["PRJ Start Date"].trim() === "") {
          errors.push("PRJ Start Date is required");
        }
        if (!row["GM Threshold"] || isNaN(parseFloat(row["GM Threshold"]))) {
          errors.push("GM Threshold is required and must be a valid number");
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
      setLoadingDeals(true);
      setCsvPreviewOpen(false);

      const text = await csvFileToUpload.text();
      const csvData = parseCSV(text);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to upload deals");
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

      // Get SPOC names to ID mapping
      const allSpocNames = [
        ...csvData.map((row: any) => row["SPOC Name"]).filter(Boolean),
        ...csvData.map((row: any) => row["SPOC 2 Name"]).filter(Boolean),
        ...csvData.map((row: any) => row["SPOC 3 Name"]).filter(Boolean),
      ];
      const uniqueSpocNames = [...new Set(allSpocNames)];
      
      const { data: contactData } = await supabase
        .from("contacts")
        .select("id, first_name, last_name");

      const spocMap: Record<string, string> = {};
      contactData?.forEach((contact) => {
        const fullName = `${contact.first_name} ${contact.last_name}`;
        spocMap[fullName] = contact.id;
      });

      // Filter out invalid rows
      const validRows = csvData.filter((row: any, index: number) => {
        const previewRow = csvPreviewRows[index];
        return previewRow?.isValid;
      });

      // Helper function to parse date from various formats (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
      const parseDate = (dateString: string): string | null => {
        if (!dateString || dateString.trim() === "") {
          return null;
        }
        
        const trimmed = dateString.trim();
        
        // Try to parse different date formats
        // Format: DD-MM-YYYY or DD/MM/YYYY
        const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (ddmmyyyyMatch) {
          const [, day, month, year] = ddmmyyyyMatch;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        
        // Format: YYYY-MM-DD (already correct)
        const yyyymmddMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (yyyymmddMatch) {
          const [, year, month, day] = yyyymmddMatch;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        
        // Try to parse as ISO date string
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
        
        return null;
      };

      const dealsToInsert = validRows.map((row: any, index: number) => {
        // Generate sales module name: Account Name - LoB - Use Case (if any)
        const accountName = row["Account Name"];
        const lob = row["LoB"];
        const useCase = row["Use Case"] && row["Use Case"].trim() !== "" ? row["Use Case"] : null;
        
        let salesModuleName = accountName;
        if (lob) {
          salesModuleName += ` - ${lob}`;
        }
        if (useCase && useCase !== "-") {
          salesModuleName += ` - ${useCase}`;
        }

        // Calculate MPV values
        const monthlyVolume = parseFloat(row["Monthly Volume"]) || 0;
        const maxMonthlyVolume = parseFloat(row["Max Monthly Volume"]) || 0;
        const commercialPerHead = parseFloat(row["Commercial per head/task"]) || 0;
        const mpv = monthlyVolume * commercialPerHead;
        const maxMpv = maxMonthlyVolume * commercialPerHead;

        // Parse PRJ Start Date
        const prjStartDate = parseDate(row["PRJ Start Date"]);
        if (!prjStartDate) {
          throw new Error(`Row ${index + 2}: Invalid PRJ Start Date format. Expected DD-MM-YYYY or YYYY-MM-DD.`);
        }

        return {
          sales_module_name: salesModuleName,
          kam_id: kamMap[row["KAM Name"]],
          account_id: accountMap[row["Account Name"]],
          spoc_id: spocMap[`${row["SPOC Name"]}`] || null,
          spoc2_id: spocMap[`${row["SPOC 2 Name"]}`] || null,
          spoc3_id: spocMap[`${row["SPOC 3 Name"]}`] || null,
          lob: row["LoB"],
          use_case: row["Use Case"] && row["Use Case"].trim() !== "" ? row["Use Case"] : "",
          sub_use_case: row["Sub Use Case"] && row["Sub Use Case"].trim() !== "" ? row["Sub Use Case"] : "",
          monthly_volume: monthlyVolume,
          max_monthly_volume: maxMonthlyVolume,
          commercial_per_head: commercialPerHead,
          expected_revenue: parseFloat(row["Expected Revenue"]) || 0,
          mpv: mpv,
          max_mpv: maxMpv,
          prj_duration_months: parseInt(row["PRJ duration in months"]) || 0,
          gm_threshold: parseFloat(row["GM Threshold"]) || 0,
          prj_frequency: row["PRJ Frequency"],
          status: "Listed", // Default status for bulk uploads
          prj_start_date: prjStartDate,
          probability: parseFloat(row["Probability"]) || 0,
          created_by: user.id,
        };
      });

      // Upsert deals in batches (update if sales_module_name exists, insert if new)
      const batchSize = 50;
      let successCount = 0;
      let updateCount = 0;
      let insertCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Get all sales module names to check which ones exist
      const salesModuleNames = dealsToInsert.map((d: any) => d.sales_module_name);
      const { data: existingDeals } = await supabase
        .from("pipeline_deals")
        .select("id, sales_module_name, status")
        .in("sales_module_name", salesModuleNames);

      const existingDealMap: Record<string, { id: string; status: string }> = {};
      existingDeals?.forEach((deal: any) => {
        existingDealMap[deal.sales_module_name] = { id: deal.id, status: deal.status };
      });

      for (let i = 0; i < dealsToInsert.length; i += batchSize) {
        const batch = dealsToInsert.slice(i, i + batchSize);
        
        // Separate into updates and inserts
        const toUpdate: any[] = [];
        const toInsert: any[] = [];

        batch.forEach((deal: any) => {
          const existingId = existingDealMap[deal.sales_module_name];
          if (existingId) {
            // Update existing
            toUpdate.push({ ...deal, id: existingId });
          } else {
            // Insert new
            toInsert.push(deal);
          }
        });

        // Update existing deals
        for (const deal of toUpdate) {
          const { id, ...updateData } = deal;
          const existingDeal = existingDealMap[deal.sales_module_name];
          const oldStatus = existingDeal?.status;
          const newStatus = updateData.status || "Listed";
          
          const { error } = await supabase
            .from("pipeline_deals")
            .update(updateData)
            .eq("id", id);
          
          if (error) {
            console.error("Error updating deal:", error);
            errors.push(`Update failed for ${deal.sales_module_name}: ${error.message}`);
            errorCount++;
          } else {
            updateCount++;
            successCount++;
            
            // Track status change in history if status changed
            if (oldStatus && oldStatus !== newStatus) {
              const { error: historyError } = await supabase
                .from("deal_status_history")
                .insert({
                  deal_id: id,
                  sales_module_name: deal.sales_module_name,
                  old_status: oldStatus,
                  new_status: newStatus,
                  changed_by: user.id,
                });
              
              if (historyError) {
                console.error("Error saving status history for bulk update:", historyError);
              }
            }
          }
        }

        // Insert new deals
        if (toInsert.length > 0) {
          const { data, error } = await supabase.from("pipeline_deals").insert(toInsert).select();
          
          if (error) {
            console.error("Error inserting batch:", error);
            console.error("Error details:", JSON.stringify(error, null, 2));
            errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
            errorCount += toInsert.length;
          } else {
            insertCount += (data?.length || 0);
            successCount += (data?.length || 0);
            
            // Track initial status for all newly inserted deals
            if (data && data.length > 0) {
              const historyRecords = data.map((deal: any) => ({
                deal_id: deal.id,
                sales_module_name: deal.sales_module_name,
                old_status: null,
                new_status: deal.status || "Listed",
                changed_by: user.id,
              }));
              
              const { error: historyError } = await supabase
                .from("deal_status_history")
                .insert(historyRecords);
              
              if (historyError) {
                console.error("Error saving status history for bulk insert:", historyError);
              }
            }
          }
        }
      }

      if (errorCount > 0) {
        toast({
          title: "Upload Partially Failed",
          description: `Successfully processed ${successCount} deals (${insertCount} inserted, ${updateCount} updated). ${errorCount} failed. ${errors.length > 0 ? `Errors: ${errors.join("; ")}` : ""}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Upload Complete",
          description: `Successfully processed ${successCount} deals (${insertCount} inserted, ${updateCount} updated).`,
        });
      }

      // Reset preview state
      setCsvPreviewRows([]);
      setCsvFileToUpload(null);

      // Reset filters to ensure new deals are visible
      setSearchTerm("");
      setFilterLob("all");
      setFilterStatus("all");

      // Refresh deals list - add a small delay to ensure database consistency
      setTimeout(() => {
        fetchDeals();
      }, 500);
    } catch (error: any) {
      console.error("Error uploading deals:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload deals. Please check the CSV format.",
        variant: "destructive",
      });
    } finally {
      setLoadingDeals(false);
    }
  };

  const handleCancelUpload = () => {
    setCsvPreviewOpen(false);
    setCsvPreviewRows([]);
    setCsvFileToUpload(null);
  };

  const handleExportDeals = async () => {
    try {
      setLoadingDeals(true);
      
      // Use filtered deals if filters are active, otherwise fetch all
      let dataToExport: any[];
      
      if (hasActiveFilters) {
        // Export filtered deals - need to fetch full data with relations for filtered deals
        const filteredDealIds = filteredDeals.map(d => d.id);
        if (filteredDealIds.length === 0) {
          toast({
            title: "No data",
            description: "No pipeline deals found to export.",
            variant: "default",
          });
          return;
        }
        
        const { data, error } = await supabase
          .from("pipeline_deals")
          .select(`
            *,
            accounts:account_id (
              id,
              name
            ),
            profiles:kam_id (
              id,
              full_name
            ),
            spoc:spoc_id (
              id,
              first_name,
              last_name
            ),
            spoc2:spoc2_id (
              id,
              first_name,
              last_name
            ),
            spoc3:spoc3_id (
              id,
              first_name,
              last_name
            )
          `)
          .in("id", filteredDealIds)
          .order("created_at", { ascending: false });

        if (error) throw error;
        dataToExport = data || [];
      } else {
        // Fetch all deals with related data
        const { data, error } = await supabase
          .from("pipeline_deals")
          .select(`
            *,
            accounts:account_id (
              id,
              name
            ),
            profiles:kam_id (
              id,
              full_name
            ),
            spoc:spoc_id (
              id,
              first_name,
              last_name
            ),
            spoc2:spoc2_id (
              id,
              first_name,
              last_name
            ),
            spoc3:spoc3_id (
              id,
              first_name,
              last_name
            )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;
        dataToExport = data || [];
      }

      if (!dataToExport || dataToExport.length === 0) {
        toast({
          title: "No data",
          description: "No pipeline deals found to export.",
          variant: "default",
        });
        return;
      }

      // Prepare data for CSV with all fields
      const csvData = dataToExport.map((deal: any) => ({
        id: deal.id || "",
        sales_module_name: deal.sales_module_name || "",
        kam_id: deal.kam_id || "",
        kam_name: deal.profiles?.full_name || "",
        account_id: deal.account_id || "",
        account_name: deal.accounts?.name || "",
        spoc_id: deal.spoc_id || "",
        spoc_name: deal.spoc ? `${deal.spoc.first_name} ${deal.spoc.last_name}` : "",
        spoc2_id: deal.spoc2_id || "",
        spoc2_name: deal.spoc2 ? `${deal.spoc2.first_name} ${deal.spoc2.last_name}` : "",
        spoc3_id: deal.spoc3_id || "",
        spoc3_name: deal.spoc3 ? `${deal.spoc3.first_name} ${deal.spoc3.last_name}` : "",
        lob: deal.lob || "",
        use_case: deal.use_case || "",
        sub_use_case: deal.sub_use_case || "",
        monthly_volume: deal.monthly_volume || 0,
        max_monthly_volume: deal.max_monthly_volume || 0,
        commercial_per_head: deal.commercial_per_head || 0,
        expected_revenue: deal.expected_revenue || 0,
        mpv: deal.mpv || 0,
        max_mpv: deal.max_mpv || 0,
        prj_duration_months: deal.prj_duration_months || "",
        gm_threshold: deal.gm_threshold || "",
        prj_frequency: deal.prj_frequency || "",
        status: deal.status || "",
        prj_start_date: formatDateForCSV(deal.prj_start_date),
        probability: deal.probability || 0,
        discovery_meeting_slides: deal.discovery_meeting_slides || "",
        solution_proposal_slides: deal.solution_proposal_slides || "",
        gantt_chart_url: deal.gantt_chart_url || "",
        expected_contract_sign_date: formatDateForCSV(deal.expected_contract_sign_date),
        final_proposal_slides: deal.final_proposal_slides || "",
        contract_sign_date: formatDateForCSV(deal.contract_sign_date),
        signed_contract_link: deal.signed_contract_link || "",
        dropped_reason: deal.dropped_reason || "",
        dropped_reason_others: deal.dropped_reason_others || "",
        created_at: formatTimestampForCSV(deal.created_at),
        updated_at: formatTimestampForCSV(deal.updated_at),
        created_by: deal.created_by || "",
      }));

      const csvContent = convertToCSV(csvData);
      const filename = hasActiveFilters 
        ? `filtered_deals_export_${new Date().toISOString().split("T")[0]}.csv`
        : `pipeline_deals_export_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCSV(csvContent, filename);

      toast({
        title: "Success!",
        description: `Exported ${csvData.length} ${hasActiveFilters ? 'filtered ' : ''}pipeline deals to CSV.`,
      });
    } catch (error: any) {
      console.error("Error exporting pipeline deals:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to export pipeline deals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDeals(false);
    }
  };

  // Fetch deals from database
  const fetchDeals = async () => {
    setLoadingDeals(true);
    try {
      const { data, error } = await supabase
        .from("pipeline_deals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching deals:", error);
        throw error;
      }

      console.log("Fetched deals from database:", data?.length || 0);

      // Fetch account names, KAM names, and contact names
      const accountIds = [...new Set((data || []).map((d: any) => d.account_id).filter(Boolean))];
      const kamIds = [...new Set((data || []).map((d: any) => d.kam_id).filter(Boolean))];
      const contactIds = [...new Set((data || []).map((d: any) => [d.spoc_id, d.spoc2_id, d.spoc3_id]).flat().filter(Boolean))];

      const accountMap: Record<string, string> = {};
      const kamMap: Record<string, string> = {};
      const contactMap: Record<string, string> = {};

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

      if (contactIds.length > 0) {
        const { data: contactData } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .in("id", contactIds);
        
        if (contactData) {
          contactData.forEach((contact) => {
            contactMap[contact.id] = `${contact.first_name} ${contact.last_name}`;
          });
        }
      }

      // Transform data for display
      const transformedDeals = (data || []).map((deal: any) => ({
        ...deal,
        account: deal.account_id ? (accountMap[deal.account_id] || "N/A") : "N/A",
        kam: deal.kam_id ? (kamMap[deal.kam_id] || "N/A") : "N/A",
        spoc: deal.spoc_id ? (contactMap[deal.spoc_id] || "N/A") : "N/A",
        spoc2: deal.spoc2_id ? (contactMap[deal.spoc2_id] || "N/A") : "N/A",
        spoc3: deal.spoc3_id ? (contactMap[deal.spoc3_id] || "N/A") : "N/A",
        useCase: deal.use_case,
        expectedRevenue: deal.expected_revenue,
      }));

      console.log("Transformed deals:", transformedDeals.length);
      setDeals(transformedDeals);
    } catch (error: any) {
      console.error("Error fetching deals:", error);
      toast({
        title: "Error",
        description: "Failed to load deals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDeals(false);
    }
  };

  // Fetch deals on component mount
  useEffect(() => {
    fetchDeals();
  }, []);

  // Fetch contacts when account changes
  useEffect(() => {
    const fetchContacts = async () => {
      if (!formData.accountId) {
        setContacts([]);
        return;
      }

      try {
        const { data: contactsData, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, account_id")
          .eq("account_id", formData.accountId)
          .order("first_name");

        if (contactsData && !error) {
          setContacts(contactsData);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    };

    fetchContacts();
  }, [formData.accountId]);

  // Auto-calculate MPV and Max MPV
  useEffect(() => {
    const monthlyVolume = parseFloat(formData.monthlyVolume) || 0;
    const commercialPerHead = parseFloat(formData.commercialPerHead) || 0;
    const maxMonthlyVolume = parseFloat(formData.maxMonthlyVolume) || 0;

    if (monthlyVolume > 0 && commercialPerHead > 0) {
      const mpv = monthlyVolume * commercialPerHead;
      setFormData((prev) => ({
        ...prev,
        mpv: mpv.toString(),
      }));
    }

    if (maxMonthlyVolume > 0 && commercialPerHead > 0) {
      const maxMpv = maxMonthlyVolume * commercialPerHead;
      setFormData((prev) => ({
        ...prev,
        maxMpv: maxMpv.toString(),
      }));
    }
  }, [formData.monthlyVolume, formData.maxMonthlyVolume, formData.commercialPerHead]);

  // Auto-calculate Probability based on status
  useEffect(() => {
    if (formData.status) {
      let probability = "0";
      if (formData.status === "Listed") probability = "10";
      else if (formData.status === "Pre-Appointment Prep Done") probability = "20";
      else if (formData.status === "Discovery Meeting Done") probability = "30";
      else if (formData.status === "Requirement Gathering Done") probability = "40";
      else if (formData.status === "Solution Proposal Made") probability = "50";
      else if (formData.status === "SOW Handshake Done") probability = "60";
      else if (formData.status === "Final Proposal Done") probability = "70";
      else if (formData.status === "Commercial Agreed") probability = "80";
      else if (formData.status === "Closed Won") probability = "100";
      else if (formData.status === "Dropped") probability = "0";

      setFormData((prev) => ({
        ...prev,
        probability,
      }));
    }
  }, [formData.status]);

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

  // Auto-generate Sales Module Name
  useEffect(() => {
    if (formData.accountId && formData.lob) {
      const account = accounts.find((a) => a.id === formData.accountId);
      // If use case is empty or '-', only use account name and LoB
      if (!formData.useCase || formData.useCase === "-") {
        const moduleName = `${account?.name || ""} - ${formData.lob}`;
        setFormData((prev) => ({
          ...prev,
          salesModuleName: moduleName,
        }));
      } else if (formData.useCase) {
        const moduleName = `${account?.name || ""} - ${formData.lob} - ${formData.useCase}`;
        setFormData((prev) => ({
          ...prev,
          salesModuleName: moduleName,
        }));
      }
    }
  }, [formData.accountId, formData.lob, formData.useCase, accounts]);

  const handleInputChange = (field: keyof DealFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("You must be logged in to create a deal");
      }

      const dealData = {
        sales_module_name: formData.salesModuleName,
        kam_id: formData.kamId || null,
        account_id: formData.accountId || null,
        spoc_id: formData.spocId || null,
        spoc2_id: formData.spoc2Id || null,
        spoc3_id: formData.spoc3Id || null,
        lob: formData.lob,
        use_case: formData.useCase,
        sub_use_case: formData.subUseCase,
        monthly_volume: parseFloat(formData.monthlyVolume) || 0,
        max_monthly_volume: parseFloat(formData.maxMonthlyVolume) || 0,
        commercial_per_head: parseFloat(formData.commercialPerHead) || 0,
        expected_revenue: parseFloat(formData.expectedRevenue) || 0,
        mpv: parseFloat(formData.mpv) || 0,
        max_mpv: parseFloat(formData.maxMpv) || 0,
        prj_duration_months: parseInt(formData.prjDurationMonths) || 0,
        gm_threshold: parseFloat(formData.gmThreshold) || 0,
        prj_frequency: formData.prjFrequency,
        status: formData.status,
        prj_start_date: formData.prjStartDate || null,
        probability: parseInt(formData.probability) || 10,
        discovery_meeting_slides: formData.discoveryMeetingSlides || null,
        solution_proposal_slides: formData.solutionProposalSlides || null,
        gantt_chart_url: formData.ganttChartUrl || null,
        expected_contract_sign_date: formData.expectedContractSignDate || null,
        final_proposal_slides: formData.finalProposalSlides || null,
        contract_sign_date: formData.contractSignDate || null,
        signed_contract_link: formData.signedContractLink || null,
        dropped_reason: formData.droppedReason || null,
        dropped_reason_others: formData.droppedReasonOthers || null,
        created_by: user.id,
      };

      const { data: newDeal, error: insertError } = await supabase
        .from("pipeline_deals")
        .insert([dealData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Track initial status in history
      const { error: historyError } = await supabase
        .from("deal_status_history")
        .insert({
          deal_id: newDeal.id,
          sales_module_name: formData.salesModuleName,
          old_status: null,
          new_status: formData.status || "Listed",
          changed_by: user.id,
        });

      if (historyError) {
        console.error("Error saving status history:", historyError);
        // Don't fail the creation if history fails, but log it
      }

      toast({
        title: "Success!",
        description: "Deal saved successfully.",
      });

      // Reset form
      setFormData({
        salesModuleName: "",
        kamId: "",
        accountId: "",
        spocId: "",
        spoc2Id: "",
        spoc3Id: "",
        lob: "",
        useCase: "",
        subUseCase: "",
        monthlyVolume: "",
        maxMonthlyVolume: "",
        commercialPerHead: "",
        expectedRevenue: "",
        mpv: "",
        maxMpv: "",
        prjDurationMonths: "",
        gmThreshold: "",
        prjFrequency: "",
        status: "Listed",
        prjStartDate: "",
        probability: "",
        discoveryMeetingSlides: "",
        solutionProposalSlides: "",
        ganttChartUrl: "",
        expectedContractSignDate: "",
        finalProposalSlides: "",
        contractSignDate: "",
        signedContractLink: "",
        droppedReason: "",
        droppedReasonOthers: "",
      });

      // Close dialog and refresh deals list
      setFormDialogOpen(false);
      fetchDeals();
    } catch (error: any) {
      console.error("Error saving deal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save deal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditDeal = async (deal: any) => {
    setSelectedDeal(deal);
    setIsEditMode(true);
    
    // Set form data
    setFormData({
      salesModuleName: deal.sales_module_name || "",
      kamId: deal.kam_id || "",
      accountId: deal.account_id || "",
      spocId: deal.spoc_id || "",
      spoc2Id: deal.spoc2_id || "",
      spoc3Id: deal.spoc3_id || "",
      lob: deal.lob || "",
      useCase: deal.use_case || "",
      subUseCase: deal.sub_use_case || "",
      monthlyVolume: deal.monthly_volume?.toString() || "",
      maxMonthlyVolume: deal.max_monthly_volume?.toString() || "",
      commercialPerHead: deal.commercial_per_head?.toString() || "",
      expectedRevenue: deal.expected_revenue?.toString() || "",
      mpv: deal.mpv?.toString() || "",
      maxMpv: deal.max_mpv?.toString() || "",
      prjDurationMonths: deal.prj_duration_months?.toString() || "",
      gmThreshold: deal.gm_threshold?.toString() || "",
      prjFrequency: deal.prj_frequency || "",
      status: deal.status || "Listed",
      prjStartDate: deal.prj_start_date || "",
      probability: deal.probability?.toString() || "",
      discoveryMeetingSlides: deal.discovery_meeting_slides || "",
      solutionProposalSlides: deal.solution_proposal_slides || "",
      ganttChartUrl: deal.gantt_chart_url || "",
      expectedContractSignDate: deal.expected_contract_sign_date || "",
      finalProposalSlides: deal.final_proposal_slides || "",
      contractSignDate: deal.contract_sign_date || "",
      signedContractLink: deal.signed_contract_link || "",
      droppedReason: deal.dropped_reason || "",
      droppedReasonOthers: deal.dropped_reason_others || "",
    });
    
    // Fetch contacts for the account if account_id exists
    if (deal.account_id) {
      try {
        const { data: contactsData, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, account_id")
          .eq("account_id", deal.account_id)
          .order("first_name");

        if (contactsData && !error) {
          setContacts(contactsData);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    }
    
    setFormDialogOpen(true);
  };

  const handleUpdateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal) return;
    
    setUpdatingDeal(true);
    try {
      const updateData: any = {
        sales_module_name: formData.salesModuleName,
        kam_id: formData.kamId || null,
        account_id: formData.accountId || null,
        spoc_id: formData.spocId || null,
        spoc2_id: formData.spoc2Id || null,
        spoc3_id: formData.spoc3Id || null,
        lob: formData.lob,
        use_case: formData.useCase,
        sub_use_case: formData.subUseCase,
        monthly_volume: parseFloat(formData.monthlyVolume) || 0,
        max_monthly_volume: parseFloat(formData.maxMonthlyVolume) || 0,
        commercial_per_head: parseFloat(formData.commercialPerHead) || 0,
        expected_revenue: parseFloat(formData.expectedRevenue) || 0,
        mpv: parseFloat(formData.mpv) || 0,
        max_mpv: parseFloat(formData.maxMpv) || 0,
        prj_duration_months: parseInt(formData.prjDurationMonths) || 0,
        gm_threshold: parseFloat(formData.gmThreshold) || 0,
        prj_frequency: formData.prjFrequency,
        status: formData.status,
        prj_start_date: formData.prjStartDate || null,
        probability: parseInt(formData.probability) || 10,
        discovery_meeting_slides: formData.discoveryMeetingSlides || null,
        solution_proposal_slides: formData.solutionProposalSlides || null,
        gantt_chart_url: formData.ganttChartUrl || null,
        expected_contract_sign_date: formData.expectedContractSignDate || null,
        final_proposal_slides: formData.finalProposalSlides || null,
        contract_sign_date: formData.contractSignDate || null,
        signed_contract_link: formData.signedContractLink || null,
        dropped_reason: formData.droppedReason || null,
        dropped_reason_others: formData.droppedReasonOthers || null,
      };

      const { error } = await supabase
        .from("pipeline_deals")
        .update(updateData)
        .eq("id", selectedDeal.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Deal updated successfully.",
      });

      setIsEditMode(false);
      setSelectedDeal(null);
      setFormDialogOpen(false);
      fetchDeals();
    } catch (error: any) {
      console.error("Error updating deal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update deal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingDeal(false);
    }
  };

  // Helper function to extract filename from URL
  const getFileNameFromUrl = (url: string, defaultName: string): string => {
    try {
      const urlPath = new URL(url).pathname;
      const fileName = urlPath.split('/').pop() || defaultName;
      return fileName.includes('.') ? fileName : `${defaultName}.pdf`;
    } catch {
      return `${defaultName}.pdf`;
    }
  };

  // Helper function to download file from URL
  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file. Please try again.",
        variant: "destructive",
      });
    }
  };

  // File upload helper function
  const uploadFile = async (file: File, dealId: string, fileType: string, statusFolder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${fileType}-${Date.now()}.${fileExt}`;
    const filePath = `${dealId}/${statusFolder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('pipeline-deal-status-files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('pipeline-deal-status-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // Get required fields for a status
  const getRequiredFieldsForStatus = (status: string): string[] => {
    switch (status) {
      case "Pre-Appointment Prep Done":
        return []; // All optional
      case "Discovery Meeting Done":
        return [];
      case "Requirement Gathering Done":
        return [];
      case "Solution Proposal Made":
        return ["solutionProposalSlides", "expectedContractSignDate"];
      case "SOW Handshake Done":
        return [];
      case "Final Proposal Done":
        return ["finalProposalSlides"];
      case "Commercial Agreed":
        return [];
      case "Closed Won":
        return ["contractSignDate", "signedContractLink"];
      case "Dropped":
        return ["droppedReason"];
      default:
        return [];
    }
  };

  // Validate status update form
  const validateStatusUpdate = (status: string, form: StatusUpdateFormData): { valid: boolean; errors: string[] } => {
    const requiredFields = getRequiredFieldsForStatus(status);
    const errors: string[] = [];

    requiredFields.forEach((field) => {
      if (field === "solutionProposalSlides" && !form.solutionProposalSlides && !form.solutionProposalSlidesFile) {
        errors.push("Solution Proposal Slides is required");
      }
      if (field === "expectedContractSignDate" && !form.expectedContractSignDate) {
        errors.push("Expected Contract Sign Date is required");
      }
      if (field === "finalProposalSlides" && !form.finalProposalSlides && !form.finalProposalSlidesFile) {
        errors.push("Final Proposal Slides is required");
      }
      if (field === "contractSignDate" && !form.contractSignDate) {
        errors.push("Contract Sign Date is required");
      }
      if (field === "signedContractLink" && !form.signedContractLink && !form.signedContractFile) {
        errors.push("Signed Contract Link is required");
      }
      if (field === "droppedReason" && !form.droppedReason) {
        errors.push("Dropped Reason is required");
      }
    });

    return { valid: errors.length === 0, errors };
  };

  // Handle opening view details dialog
  const handleViewDetails = (deal: any) => {
    setSelectedDealForView(deal);
    setViewDetailsDialogOpen(true);
  };

  const handleDeleteDeal = async () => {
    if (!dealToDelete?.id) return;

    setDeletingDeal(true);
    try {
      const { error } = await supabase
        .from("pipeline_deals")
        .delete()
        .eq("id", dealToDelete.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Deal deleted successfully",
      });

      // Refresh deals list
      fetchDeals();
      setDeleteDialogOpen(false);
      setDealToDelete(null);
    } catch (error: any) {
      console.error("Error deleting deal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete deal",
        variant: "destructive",
      });
    } finally {
      setDeletingDeal(false);
    }
  };

  // Handle opening status update dialog from view details
  const handleUpdateStatusFromView = (deal: any) => {
    setViewDetailsDialogOpen(false);
    setDealForStatusUpdate(deal);
    setStatusUpdateForm({
      newStatus: "", // Empty to show placeholder
      discoveryMeetingSlides: deal.discovery_meeting_slides || "",
      discoveryMeetingSlidesFile: null,
      solutionProposalSlides: deal.solution_proposal_slides || "",
      solutionProposalSlidesFile: null,
      ganttChartUrl: deal.gantt_chart_url || "",
      ganttChartFile: null,
      expectedContractSignDate: deal.expected_contract_sign_date || "",
      finalProposalSlides: deal.final_proposal_slides || "",
      finalProposalSlidesFile: null,
      contractSignDate: deal.contract_sign_date || "",
      signedContractLink: deal.signed_contract_link || "",
      signedContractFile: null,
      droppedReason: deal.dropped_reason || "",
      droppedReasonOthers: deal.dropped_reason_others || "",
    });
    setStatusUpdateDialogOpen(true);
  };

  // Handle opening edit dialog from view details
  const handleEditFromView = (deal: any) => {
    setViewDetailsDialogOpen(false);
    handleEditDeal(deal);
  };

  // Handle opening status update dialog
  const handleUpdateStatus = (deal: any) => {
    setDealForStatusUpdate(deal);
    setStatusUpdateForm({
      newStatus: "", // Empty to show placeholder
      discoveryMeetingSlides: deal.discovery_meeting_slides || "",
      discoveryMeetingSlidesFile: null,
      solutionProposalSlides: deal.solution_proposal_slides || "",
      solutionProposalSlidesFile: null,
      ganttChartUrl: deal.gantt_chart_url || "",
      ganttChartFile: null,
      expectedContractSignDate: deal.expected_contract_sign_date || "",
      finalProposalSlides: deal.final_proposal_slides || "",
      finalProposalSlidesFile: null,
      contractSignDate: deal.contract_sign_date || "",
      signedContractLink: deal.signed_contract_link || "",
      signedContractFile: null,
      droppedReason: deal.dropped_reason || "",
      droppedReasonOthers: deal.dropped_reason_others || "",
    });
    setStatusUpdateDialogOpen(true);
  };

  // Handle status update submission
  const handleStatusUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealForStatusUpdate) return;

    // Validate required fields
    const validation = validateStatusUpdate(statusUpdateForm.newStatus, statusUpdateForm);
    if (!validation.valid) {
      toast({
        title: "Validation Error",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setUpdatingStatus(true);
    try {
      const dealId = dealForStatusUpdate.id;
      const oldStatus = dealForStatusUpdate.status;
      const newStatus = statusUpdateForm.newStatus;
      const salesModuleName = dealForStatusUpdate.sales_module_name;
      
      const updateData: any = {
        status: newStatus,
      };

      // Track status change in history (only if status actually changed)
      if (oldStatus !== newStatus) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error: historyError } = await supabase
          .from("deal_status_history")
          .insert({
            deal_id: dealId,
            sales_module_name: salesModuleName,
            old_status: oldStatus,
            new_status: newStatus,
            changed_by: user?.id || null,
          });

        if (historyError) {
          console.error("Error saving status history:", historyError);
          // Don't fail the update if history fails, but log it
        }
      }

      // Upload files and update URLs
      if (statusUpdateForm.discoveryMeetingSlidesFile) {
        const url = await uploadFile(
          statusUpdateForm.discoveryMeetingSlidesFile,
          dealId,
          "discovery-meeting-slides",
          "pre-appointment-prep-done"
        );
        updateData.discovery_meeting_slides = url;
      } else if (statusUpdateForm.discoveryMeetingSlides) {
        updateData.discovery_meeting_slides = statusUpdateForm.discoveryMeetingSlides;
      }

      if (statusUpdateForm.solutionProposalSlidesFile) {
        const url = await uploadFile(
          statusUpdateForm.solutionProposalSlidesFile,
          dealId,
          "solution-proposal-slides",
          "solution-proposal-made"
        );
        updateData.solution_proposal_slides = url;
      } else if (statusUpdateForm.solutionProposalSlides) {
        updateData.solution_proposal_slides = statusUpdateForm.solutionProposalSlides;
      }

      if (statusUpdateForm.ganttChartFile) {
        const url = await uploadFile(
          statusUpdateForm.ganttChartFile,
          dealId,
          "gantt-chart",
          "solution-proposal-made"
        );
        updateData.gantt_chart_url = url;
      } else if (statusUpdateForm.ganttChartUrl) {
        updateData.gantt_chart_url = statusUpdateForm.ganttChartUrl;
      }

      if (statusUpdateForm.finalProposalSlidesFile) {
        const url = await uploadFile(
          statusUpdateForm.finalProposalSlidesFile,
          dealId,
          "final-proposal-slides",
          "final-proposal-done"
        );
        updateData.final_proposal_slides = url;
      } else if (statusUpdateForm.finalProposalSlides) {
        updateData.final_proposal_slides = statusUpdateForm.finalProposalSlides;
      }

      if (statusUpdateForm.signedContractFile) {
        const url = await uploadFile(
          statusUpdateForm.signedContractFile,
          dealId,
          "signed-contract",
          "closed-won"
        );
        updateData.signed_contract_link = url;
      } else if (statusUpdateForm.signedContractLink) {
        updateData.signed_contract_link = statusUpdateForm.signedContractLink;
      }

      // Update date fields
      if (statusUpdateForm.expectedContractSignDate) {
        updateData.expected_contract_sign_date = statusUpdateForm.expectedContractSignDate;
      }
      if (statusUpdateForm.contractSignDate) {
        updateData.contract_sign_date = statusUpdateForm.contractSignDate;
      }

      // Update dropped reason fields
      if (statusUpdateForm.droppedReason) {
        updateData.dropped_reason = statusUpdateForm.droppedReason;
        updateData.dropped_reason_others = statusUpdateForm.droppedReasonOthers || null;
      }

      // Update probability based on new status
      let probability = 10;
      if (statusUpdateForm.newStatus === "Listed") probability = 10;
      else if (statusUpdateForm.newStatus === "Pre-Appointment Prep Done") probability = 20;
      else if (statusUpdateForm.newStatus === "Discovery Meeting Done") probability = 30;
      else if (statusUpdateForm.newStatus === "Requirement Gathering Done") probability = 40;
      else if (statusUpdateForm.newStatus === "Solution Proposal Made") probability = 50;
      else if (statusUpdateForm.newStatus === "SOW Handshake Done") probability = 60;
      else if (statusUpdateForm.newStatus === "Final Proposal Done") probability = 70;
      else if (statusUpdateForm.newStatus === "Commercial Agreed") probability = 80;
      else if (statusUpdateForm.newStatus === "Closed Won") probability = 100;
      else if (statusUpdateForm.newStatus === "Dropped") probability = 0;

      updateData.probability = probability;

      const { error } = await supabase
        .from("pipeline_deals")
        .update(updateData)
        .eq("id", dealId);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Deal status updated successfully.",
      });

      setStatusUpdateDialogOpen(false);
      setDealForStatusUpdate(null);
      fetchDeals();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const showProposalBlock = formData.status === "Solution Proposal Made" || formData.status === "SOW Handshake Done" || formData.status === "Final Proposal Done";
  const showClosedWonBlock = formData.status === "Closed Won";
  const showDroppedBlock = formData.status === "Dropped";

  const filteredDeals = deals
    .filter((deal) => {
      // Search across all displayed fields
      const matchesSearch = !searchTerm || (() => {
        const searchLower = searchTerm.toLowerCase();
        const searchableFields = [
          deal.sales_module_name || "",
          deal.account || "",
          deal.kam || "",
          deal.lob || "",
          deal.expectedRevenue ? `₹${parseFloat(deal.expectedRevenue).toLocaleString("en-IN")}` : "",
          deal.status || "",
          deal.useCase || "",
        ];
        return searchableFields.some(field => field.toLowerCase().includes(searchLower));
      })();
      
      const matchesAccount = filterAccount === "all" || deal.account_id === filterAccount;
      const matchesKam = filterKam === "all" || deal.kam_id === filterKam;
      const matchesLob = filterLob === "all" || deal.lob === filterLob;
      const matchesStatus = filterStatus === "all" || deal.status === filterStatus;

      return matchesSearch && matchesAccount && matchesKam && matchesLob && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        // Sort by created_at descending (newest first)
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      } else if (sortBy === "oldest") {
        // Sort by created_at ascending (oldest first)
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      } else if (sortBy === "status") {
        // Sort by status order (chronological)
        const orderA = statusOrder[a.status] || 999;
        const orderB = statusOrder[b.status] || 999;
        return orderA - orderB;
      }
      return 0;
    });

  // Check if any filters are active
  const hasActiveFilters = searchTerm || filterAccount !== "all" || filterKam !== "all" || filterLob !== "all" || filterStatus !== "all";

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cross Sell Pipeline</h1>
          <p className="text-muted-foreground">
            Manage your cross-sell opportunities and track deal progress.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportDeals}
            disabled={loadingDeals}
          >
            <Download className="mr-2 h-4 w-4" />
            {hasActiveFilters ? "Download Filtered Deals" : "Export Deals"}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadDealTemplate}
          >
            <FileText className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <label>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleBulkUploadDeals(file);
                }
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              asChild
              disabled={loadingDeals}
            >
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </span>
            </Button>
          </label>
          <Button onClick={() => setFormDialogOpen(true)}>
            Add Deal
          </Button>
        </div>
      </div>

      {/* Add/Edit Deal Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => {
        setFormDialogOpen(open);
        if (!open) {
          // Reset form when dialog closes
          setIsEditMode(false);
          setSelectedDeal(null);
          setFormData({
            salesModuleName: "",
            kamId: "",
            accountId: "",
            spocId: "",
            spoc2Id: "",
            spoc3Id: "",
            lob: "",
            useCase: "",
            subUseCase: "",
            monthlyVolume: "",
            maxMonthlyVolume: "",
            commercialPerHead: "",
            expectedRevenue: "",
            mpv: "",
            maxMpv: "",
            prjDurationMonths: "",
            gmThreshold: "",
            prjFrequency: "",
            status: "Listed",
            prjStartDate: "",
            probability: "",
            discoveryMeetingSlides: "",
            solutionProposalSlides: "",
            ganttChartUrl: "",
            expectedContractSignDate: "",
            finalProposalSlides: "",
            contractSignDate: "",
            signedContractLink: "",
            droppedReason: "",
            droppedReasonOthers: "",
          });
          setAccountSearch("");
          setKamSearch("");
          setSpocSearch("");
          setSpoc2Search("");
          setSpoc3Search("");
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Deal" : "Add Deal"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={isEditMode ? handleUpdateDeal : handleSubmit} className="space-y-6">
            {/* Sales Module Section */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 text-blue-900">Sales Module</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="salesModuleName">
                      Sales Module Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="salesModuleName"
                      value={formData.salesModuleName}
                      placeholder="Auto"
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kamId">
                      KAM <span className="text-destructive">*</span>
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
                </div>
              </CardContent>
            </Card>

            {/* Deal Details Section */}
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 text-green-900">Deal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountId">
                      Account <span className="text-destructive">*</span>
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
                    <Label htmlFor="lob">
                      LoB <span className="text-destructive">*</span>
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
                        {lobOptions.map((lob) => (
                          <SelectItem key={lob} value={lob}>
                            {lob}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spocId">
                      SPOC <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.spocId}
                      onValueChange={(value) => handleInputChange("spocId", value)}
                      required
                      disabled={!formData.accountId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SPOC" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Search contacts..."
                            value={spocSearch}
                            onChange={(e) => setSpocSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                        </div>
                        {contacts.length > 0 ? (
                          contacts
                            .filter((contact) =>
                              `${contact.first_name} ${contact.last_name}`
                                .toLowerCase()
                                .includes(spocSearch.toLowerCase())
                            )
                            .map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.first_name} {contact.last_name}
                              </SelectItem>
                            ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {formData.accountId ? "No contacts available" : "Select account first"}
                          </div>
                        )}
                        {contacts.length > 0 && contacts.filter((contact) =>
                          `${contact.first_name} ${contact.last_name}`
                            .toLowerCase()
                            .includes(spocSearch.toLowerCase())
                        ).length === 0 && spocSearch && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No contacts found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
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
                    <Label htmlFor="spoc2Id">SPOC 2</Label>
                    <Select
                      value={formData.spoc2Id || undefined}
                      onValueChange={(value) => handleInputChange("spoc2Id", value)}
                      disabled={!formData.accountId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SPOC 2 (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Search contacts..."
                            value={spoc2Search}
                            onChange={(e) => setSpoc2Search(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                        </div>
                        {contacts.length > 0 ? (
                          contacts
                            .filter((contact) =>
                              `${contact.first_name} ${contact.last_name}`
                                .toLowerCase()
                                .includes(spoc2Search.toLowerCase())
                            )
                            .map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.first_name} {contact.last_name}
                              </SelectItem>
                            ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {formData.accountId ? "No contacts available" : "Select account first"}
                          </div>
                        )}
                        {contacts.length > 0 && contacts.filter((contact) =>
                          `${contact.first_name} ${contact.last_name}`
                            .toLowerCase()
                            .includes(spoc2Search.toLowerCase())
                        ).length === 0 && spoc2Search && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No contacts found
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
                    <Label htmlFor="spoc3Id">SPOC 3</Label>
                    <Select
                      value={formData.spoc3Id || undefined}
                      onValueChange={(value) => handleInputChange("spoc3Id", value)}
                      disabled={!formData.accountId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SPOC 3 (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Search contacts..."
                            value={spoc3Search}
                            onChange={(e) => setSpoc3Search(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                        </div>
                        {contacts.length > 0 ? (
                          contacts
                            .filter((contact) =>
                              `${contact.first_name} ${contact.last_name}`
                                .toLowerCase()
                                .includes(spoc3Search.toLowerCase())
                            )
                            .map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.first_name} {contact.last_name}
                              </SelectItem>
                            ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {formData.accountId ? "No contacts available" : "Select account first"}
                          </div>
                        )}
                        {contacts.length > 0 && contacts.filter((contact) =>
                          `${contact.first_name} ${contact.last_name}`
                            .toLowerCase()
                            .includes(spoc3Search.toLowerCase())
                        ).length === 0 && spoc3Search && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No contacts found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Info Section */}
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 text-purple-900">Revenue Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="mpv">
                      MPV <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="mpv"
                      value={formData.mpv}
                      placeholder="Auto"
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="maxMpv">
                      Max MPV <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="maxMpv"
                      value={formData.maxMpv}
                      placeholder="Auto"
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="expectedRevenue">
                      Expected Revenue <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="expectedRevenue"
                      type="number"
                      value={formData.expectedRevenue}
                      onChange={(e) => handleInputChange("expectedRevenue", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyVolume">
                      Monthly Volume <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="monthlyVolume"
                      type="number"
                      value={formData.monthlyVolume}
                      onChange={(e) => handleInputChange("monthlyVolume", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gmThreshold">
                      GM Threshold <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="gmThreshold"
                      type="number"
                      value={formData.gmThreshold}
                      onChange={(e) => handleInputChange("gmThreshold", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxMonthlyVolume">
                      Maximum Monthly Volume <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="maxMonthlyVolume"
                      type="number"
                      value={formData.maxMonthlyVolume}
                      onChange={(e) => handleInputChange("maxMonthlyVolume", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prjFrequency">
                      PRJ Frequency <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.prjFrequency}
                      onValueChange={(value) => handleInputChange("prjFrequency", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {prjFrequencyOptions.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="commercialPerHead">
                      Commercial per head/task <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="commercialPerHead"
                      type="number"
                      value={formData.commercialPerHead}
                      onChange={(e) => handleInputChange("commercialPerHead", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="prjDurationMonths">
                      PRJ duration (months) <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.prjDurationMonths}
                      onValueChange={(value) => handleInputChange("prjDurationMonths", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {prjDurationOptions.map((duration) => (
                          <SelectItem key={duration} value={duration}>
                            {duration}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Based Details Section */}
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">
                      STATUS <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleInputChange("status", value)}
                      required
                      disabled={!isEditMode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {formatStatusWithNumber(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="probability">Probability (Auto)</Label>
                    <Input
                      id="probability"
                      value={formData.probability}
                      placeholder="Auto"
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prjStartDate">
                      PRJ Start Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="prjStartDate"
                      type="date"
                      value={formData.prjStartDate}
                      onChange={(e) => handleInputChange("prjStartDate", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Based Details - Additional Fields */}
            {(
              formData.solutionProposalSlides ||
              formData.ganttChartUrl ||
              formData.finalProposalSlides ||
              formData.signedContractLink ||
              formData.droppedReason ||
              formData.droppedReasonOthers
            ) && (
              <div>
                <h3 className="font-semibold text-lg mb-4">Status Based Details</h3>
                <div className="space-y-6">
                {/* Proposal Stage Block */}
                {showProposalBlock && (
                  <Card className="border rounded-xl bg-slate-50">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-4">Proposal Stage Files</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="solutionProposalSlides">
                            Solution Proposal Slides <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="solutionProposalSlides"
                            value={formData.solutionProposalSlides}
                            onChange={(e) => handleInputChange("solutionProposalSlides", e.target.value)}
                            placeholder="URL"
                            required={showProposalBlock}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ganttChartUrl">Gantt Chart URL (optional)</Label>
                          <Input
                            id="ganttChartUrl"
                            value={formData.ganttChartUrl}
                            onChange={(e) => handleInputChange("ganttChartUrl", e.target.value)}
                            placeholder="URL"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Closed Won Block */}
                {showClosedWonBlock && (
                  <Card className="border rounded-xl bg-green-50">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-4">Closed Won Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="signedContractLink">
                            Signed Contract Link <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="signedContractLink"
                            value={formData.signedContractLink}
                            onChange={(e) => handleInputChange("signedContractLink", e.target.value)}
                            placeholder="URL"
                            required={showClosedWonBlock}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Dropped Block */}
                {showDroppedBlock && (
                  <Card className="border rounded-xl bg-rose-50">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-4">Dropped Reason</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="droppedReason">
                            Reason <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.droppedReason}
                            onValueChange={(value) => handleInputChange("droppedReason", value)}
                            required={showDroppedBlock}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {droppedReasons.map((reason) => (
                                <SelectItem key={reason} value={reason}>
                                  {reason}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="droppedReasonOthers">Reason - Others</Label>
                          <Input
                            id="droppedReasonOthers"
                            value={formData.droppedReasonOthers}
                            onChange={(e) => handleInputChange("droppedReasonOthers", e.target.value)}
                            disabled={formData.droppedReason !== "Others (put details below)"}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormDialogOpen(false);
                  setIsEditMode(false);
                  setSelectedDeal(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || updatingDeal}>
                {(loading || updatingDeal) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Updating..." : "Saving..."}
                  </>
                ) : (
                  isEditMode ? "Update Deal" : "Save Deal"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW DEALS */}
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-lg mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
              <Input
                placeholder="Search all fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger>
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
                <SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="All LoB" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All LoB</SelectItem>
                  {lobOptions.map((lob) => (
                    <SelectItem key={lob} value={lob}>
                      {lob}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  {filterStatus === "all" ? (
                    <SelectValue placeholder="All Status" />
                  ) : (
                    <div className="flex items-center">
                      {(() => {
                        const badgeStyle = getStatusBadgeStyle(filterStatus);
                        return (
                          <Badge
                            variant={badgeStyle.variant}
                            className={badgeStyle.className}
                          >
                            {filterStatus}
                          </Badge>
                        );
                      })()}
                    </div>
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((status) => {
                    const badgeStyle = getStatusBadgeStyle(status);
                    return (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={badgeStyle.variant}
                            className={badgeStyle.className}
                          >
                            {formatStatusWithNumber(status)}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Sort By:</Label>
              <Select value={sortBy} onValueChange={(value: "newest" | "oldest" | "status") => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
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
                    <TableHead>Sales Module Name</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>KAM</TableHead>
                    <TableHead>LoB</TableHead>
                    <TableHead>Expected Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDeals ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Loading deals...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No deals found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeals.map((deal) => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium"><HighlightedText text={deal.sales_module_name || "N/A"} searchTerm={searchTerm} /></TableCell>
                        <TableCell><HighlightedText text={deal.account || "N/A"} searchTerm={searchTerm} /></TableCell>
                        <TableCell><HighlightedText text={deal.kam || "N/A"} searchTerm={searchTerm} /></TableCell>
                        <TableCell><HighlightedText text={deal.lob || "N/A"} searchTerm={searchTerm} /></TableCell>
                        <TableCell>
                          <HighlightedText
                            text={
                              deal.expectedRevenue
                                ? `₹${parseFloat(deal.expectedRevenue).toLocaleString("en-IN")}`
                                : "N/A"
                            }
                            searchTerm={searchTerm}
                          />
                        </TableCell>
                        <TableCell>
                          {deal.status ? (
                            <Badge
                              variant={getStatusBadgeStyle(deal.status).variant}
                              className={getStatusBadgeStyle(deal.status).className}
                            >
                              <HighlightedText text={formatStatusWithNumber(deal.status)} searchTerm={searchTerm} />
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewDetails(deal)}
                            >
                              View Details
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleUpdateStatus(deal)}
                            >
                              Update Status
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDealToDelete(deal);
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
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsDialogOpen} onOpenChange={(open) => {
        setViewDetailsDialogOpen(open);
        if (!open) {
          setSelectedDealForView(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>
                  {selectedDealForView?.sales_module_name || "Deal Details"}
                </DialogTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedDealForView) {
                        setViewDetailsDialogOpen(false);
                        handleEditDeal(selectedDealForView);
                      }
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
          </DialogHeader>
          {selectedDealForView && (
            <div className="space-y-6">
              {/* Deal Information Section */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">Deal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Sales Module Name:</Label>
                      <p className="mt-1">{selectedDealForView.sales_module_name || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">KAM:</Label>
                      <p className="mt-1">{selectedDealForView.kam || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Account:</Label>
                      <p className="mt-1">{selectedDealForView.account || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">LoB:</Label>
                      <p className="mt-1">{selectedDealForView.lob || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Use Case:</Label>
                      <p className="mt-1">{selectedDealForView.use_case || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Sub Use Case:</Label>
                      <p className="mt-1">{selectedDealForView.sub_use_case || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">SPOC:</Label>
                      <p className="mt-1">{selectedDealForView.spoc || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">SPOC 2:</Label>
                      <p className="mt-1">{selectedDealForView.spoc2 || "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">SPOC 3:</Label>
                      <p className="mt-1">{selectedDealForView.spoc3 || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Info Section */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Revenue Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">MPV:</Label>
                      <p className="mt-1">{selectedDealForView.mpv ? selectedDealForView.mpv.toLocaleString("en-IN") : "N/A"}</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">Max MPV:</Label>
                      <p className="mt-1">{selectedDealForView.max_mpv ? selectedDealForView.max_mpv.toLocaleString("en-IN") : "N/A"}</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">Expected Revenue:</Label>
                      <p className="mt-1">
                        {selectedDealForView.expected_revenue
                          ? `₹${selectedDealForView.expected_revenue.toLocaleString("en-IN")}`
                          : "N/A"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Monthly Volume:</Label>
                      <p className="mt-1">{selectedDealForView.monthly_volume ? selectedDealForView.monthly_volume.toLocaleString("en-IN") : "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">GM Threshold:</Label>
                      <p className="mt-1">{selectedDealForView.gm_threshold ? selectedDealForView.gm_threshold.toLocaleString("en-IN") : "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Maximum Monthly Volume:</Label>
                      <p className="mt-1">{selectedDealForView.max_monthly_volume ? selectedDealForView.max_monthly_volume.toLocaleString("en-IN") : "N/A"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">PRJ Frequency:</Label>
                      <p className="mt-1">{selectedDealForView.prj_frequency || "N/A"}</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">Commercial per head/task:</Label>
                      <p className="mt-1">{selectedDealForView.commercial_per_head ? selectedDealForView.commercial_per_head.toLocaleString("en-IN") : "N/A"}</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">PRJ duration (months):</Label>
                      <p className="mt-1">{selectedDealForView.prj_duration_months || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Based Details Section */}
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-orange-900">Status Based Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">STATUS:</Label>
                      <p className="mt-1">
                        <Badge variant="outline">{selectedDealForView.status ? formatStatusWithNumber(selectedDealForView.status) : "N/A"}</Badge>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className={`font-medium ${selectedDealForView.expected_contract_sign_date ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                        Expected Contract Sign Date:
                      </Label>
                      <p className={`mt-1 ${selectedDealForView.expected_contract_sign_date ? "" : "text-muted-foreground/50 italic"}`}>
                        {selectedDealForView.expected_contract_sign_date || "Not set"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Probability:</Label>
                      <p className="mt-1">{selectedDealForView.probability || "N/A"}%</p>
                    </div>
                    <div className="space-y-2">
                      <Label className={`font-medium ${selectedDealForView.contract_sign_date ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                        Contract Sign Date:
                      </Label>
                      <p className={`mt-1 ${selectedDealForView.contract_sign_date ? "" : "text-muted-foreground/50 italic"}`}>
                        {selectedDealForView.contract_sign_date || "Not set"}
                      </p>
                    </div>
                    <div className="space-y-2"></div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">PRJ Start Date:</Label>
                      <p className="mt-1">{selectedDealForView.prj_start_date || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attached Documents Section */}
              {(selectedDealForView.discovery_meeting_slides || 
                selectedDealForView.solution_proposal_slides || 
                selectedDealForView.gantt_chart_url || 
                selectedDealForView.final_proposal_slides ||
                selectedDealForView.signed_contract_link) && (
                <Card className="border-indigo-200 bg-indigo-50/50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-lg mb-4 text-indigo-900">Attached Documents</h3>
                    <div className="space-y-3">
                      {selectedDealForView.discovery_meeting_slides && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <span className="text-blue-600 font-semibold">DM</span>
                            </div>
                            <div>
                              <p className="font-medium">Discovery Meeting Slides</p>
                              <p className="text-sm text-muted-foreground">Pre-Appointment Prep Done</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedDealForView.discovery_meeting_slides, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(
                                selectedDealForView.discovery_meeting_slides,
                                getFileNameFromUrl(selectedDealForView.discovery_meeting_slides, 'discovery-meeting-slides')
                              )}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                      {selectedDealForView.solution_proposal_slides && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <span className="text-green-600 font-semibold">SP</span>
                            </div>
                            <div>
                              <p className="font-medium">Solution Proposal Slides</p>
                              <p className="text-sm text-muted-foreground">Solution Proposal Made</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedDealForView.solution_proposal_slides, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(
                                selectedDealForView.solution_proposal_slides,
                                getFileNameFromUrl(selectedDealForView.solution_proposal_slides, 'solution-proposal-slides')
                              )}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                      {selectedDealForView.gantt_chart_url && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                              <span className="text-purple-600 font-semibold">GC</span>
                            </div>
                            <div>
                              <p className="font-medium">Gantt Chart</p>
                              <p className="text-sm text-muted-foreground">Solution Proposal Made</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedDealForView.gantt_chart_url, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(
                                selectedDealForView.gantt_chart_url,
                                getFileNameFromUrl(selectedDealForView.gantt_chart_url, 'gantt-chart')
                              )}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                      {selectedDealForView.final_proposal_slides && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                              <span className="text-orange-600 font-semibold">FP</span>
                            </div>
                            <div>
                              <p className="font-medium">Final Proposal Slides</p>
                              <p className="text-sm text-muted-foreground">Final Proposal Done</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedDealForView.final_proposal_slides, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(
                                selectedDealForView.final_proposal_slides,
                                getFileNameFromUrl(selectedDealForView.final_proposal_slides, 'final-proposal-slides')
                              )}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                      {selectedDealForView.signed_contract_link && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                              <span className="text-emerald-600 font-semibold">SC</span>
                            </div>
                            <div>
                              <p className="font-medium">Signed Contract</p>
                              <p className="text-sm text-muted-foreground">Closed Won</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedDealForView.signed_contract_link, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(
                                selectedDealForView.signed_contract_link,
                                getFileNameFromUrl(selectedDealForView.signed_contract_link, 'signed-contract')
                              )}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateDialogOpen} onOpenChange={(open) => {
        setStatusUpdateDialogOpen(open);
        if (!open) {
          setDealForStatusUpdate(null);
          setStatusUpdateForm({
            newStatus: "",
            discoveryMeetingSlides: "",
            discoveryMeetingSlidesFile: null,
            solutionProposalSlides: "",
            solutionProposalSlidesFile: null,
            ganttChartUrl: "",
            ganttChartFile: null,
            expectedContractSignDate: "",
            finalProposalSlides: "",
            finalProposalSlidesFile: null,
            contractSignDate: "",
            signedContractLink: "",
            signedContractFile: null,
            droppedReason: "",
            droppedReasonOthers: "",
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Deal Status</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusUpdateSubmit} className="space-y-6">
            {/* Current Status Display */}
            {dealForStatusUpdate && (
              <div className="space-y-2">
                <Label>Current Status</Label>
                <div className="px-3 py-2 bg-muted rounded-md border">
                  <span className="font-medium">{formatStatusWithNumber(dealForStatusUpdate.status || "")}</span>
                </div>
              </div>
            )}
            
            {/* Status Selection */}
            <div className="space-y-2">
              <Label htmlFor="newStatus">
                New Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={statusUpdateForm.newStatus}
                onValueChange={(value) => setStatusUpdateForm({ ...statusUpdateForm, newStatus: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Click for Status Dropdown" />
                </SelectTrigger>
                <SelectContent>
                  {dealForStatusUpdate && getValidStatusOptions(dealForStatusUpdate.status || "").map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatStatusWithNumber(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pre-Appointment Prep Done Fields */}
            {statusUpdateForm.newStatus === "Pre-Appointment Prep Done" && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4">Pre-Appointment Prep Done Details</h4>
                  <div className="space-y-2">
                    <Label htmlFor="discoveryMeetingSlides">
                      Discovery Meeting Slides (Optional)
                    </Label>
                    <Input
                      id="discoveryMeetingSlides"
                      type="file"
                      accept=".pdf,.ppt,.pptx,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setStatusUpdateForm({ ...statusUpdateForm, discoveryMeetingSlidesFile: file });
                        }
                      }}
                    />
                    <Input
                      placeholder="Or enter URL"
                      value={statusUpdateForm.discoveryMeetingSlides}
                      onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, discoveryMeetingSlides: e.target.value })}
                    />
                    {statusUpdateForm.discoveryMeetingSlidesFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {statusUpdateForm.discoveryMeetingSlidesFile.name}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Solution Proposal Made Fields */}
            {statusUpdateForm.newStatus === "Solution Proposal Made" && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4">Solution Proposal Made Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="solutionProposalSlides">
                        Solution Proposal Slides <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="solutionProposalSlides"
                        type="file"
                        accept=".pdf,.ppt,.pptx,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setStatusUpdateForm({ ...statusUpdateForm, solutionProposalSlidesFile: file });
                          }
                        }}
                      />
                      <Input
                        placeholder="Or enter URL"
                        value={statusUpdateForm.solutionProposalSlides}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, solutionProposalSlides: e.target.value })}
                      />
                      {statusUpdateForm.solutionProposalSlidesFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {statusUpdateForm.solutionProposalSlidesFile.name}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ganttChart">
                        Gantt Chart Link (Optional)
                      </Label>
                      <Input
                        id="ganttChart"
                        type="file"
                        accept=".pdf,.xls,.xlsx,.png,.jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setStatusUpdateForm({ ...statusUpdateForm, ganttChartFile: file });
                          }
                        }}
                      />
                      <Input
                        placeholder="Or enter URL"
                        value={statusUpdateForm.ganttChartUrl}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, ganttChartUrl: e.target.value })}
                      />
                      {statusUpdateForm.ganttChartFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {statusUpdateForm.ganttChartFile.name}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="expectedContractSignDate">
                        Expected Contract Sign Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="expectedContractSignDate"
                        type="date"
                        value={statusUpdateForm.expectedContractSignDate}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, expectedContractSignDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Final Proposal Done Fields */}
            {statusUpdateForm.newStatus === "Final Proposal Done" && (
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4">Final Proposal Done Details</h4>
                  <div className="space-y-2">
                    <Label htmlFor="finalProposalSlides">
                      Final (Solution) Proposal Slides <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="finalProposalSlides"
                      type="file"
                      accept=".pdf,.ppt,.pptx,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setStatusUpdateForm({ ...statusUpdateForm, finalProposalSlidesFile: file });
                        }
                      }}
                    />
                    <Input
                      placeholder="Or enter URL"
                      value={statusUpdateForm.finalProposalSlides}
                      onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, finalProposalSlides: e.target.value })}
                    />
                    {statusUpdateForm.finalProposalSlidesFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {statusUpdateForm.finalProposalSlidesFile.name}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Closed Won Fields */}
            {statusUpdateForm.newStatus === "Closed Won" && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4">Closed Won Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contractSignDate">
                        Contract Sign Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contractSignDate"
                        type="date"
                        value={statusUpdateForm.contractSignDate}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, contractSignDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signedContractLink">
                        Signed Contract Link <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signedContractLink"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setStatusUpdateForm({ ...statusUpdateForm, signedContractFile: file });
                          }
                        }}
                      />
                      <Input
                        placeholder="Or enter URL"
                        value={statusUpdateForm.signedContractLink}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, signedContractLink: e.target.value })}
                      />
                      {statusUpdateForm.signedContractFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {statusUpdateForm.signedContractFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dropped Fields */}
            {statusUpdateForm.newStatus === "Dropped" && (
              <Card className="border-rose-200 bg-rose-50/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4">Dropped Reason</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="droppedReason">
                        Reason <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={statusUpdateForm.droppedReason}
                        onValueChange={(value) => setStatusUpdateForm({ ...statusUpdateForm, droppedReason: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {droppedReasons.map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {reason}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="droppedReasonOthers">Reason - Others</Label>
                      <Input
                        id="droppedReasonOthers"
                        value={statusUpdateForm.droppedReasonOthers}
                        onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, droppedReasonOthers: e.target.value })}
                        disabled={statusUpdateForm.droppedReason !== "Others (put details below)"}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusUpdateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatingStatus}>
                {updatingStatus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV Preview Dialog */}
      <CSVPreviewDialog
        open={csvPreviewOpen}
        onOpenChange={setCsvPreviewOpen}
        rows={csvPreviewRows}
        onConfirm={handleConfirmUpload}
        onCancel={handleCancelUpload}
        loading={loadingDeals}
        title="Preview Pipeline Deals CSV Upload"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the deal "{dealToDelete?.sales_module_name || dealToDelete?.account}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDeal}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDeal}
              disabled={deletingDeal}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDeal ? (
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
