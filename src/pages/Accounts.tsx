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
import { convertToCSV, downloadCSV, formatTimestampForCSV, downloadCSVTemplate, parseCSV } from "@/lib/csv-export";
import { CSVPreviewDialog } from "@/components/CSVPreviewDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewMode = "form" | "view";

interface AccountFormData {
  name: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  foundedYear: string;
  industry: string;
  subCategory: string;
  revenueRange: string;
  totalACV: string;
  totalMCV: string;
  mcvTier: string;
  companySizeTier: string;
}

// Industry to Sub Category mapping
const industrySubCategories: Record<string, string[]> = {
  "Manufacturing": ["Automotive", "Electronics", "Textiles", "Pharmaceuticals", "Food & Beverage", "Others"],
  "FMCG": ["Personal Care", "Food Products", "Beverages", "Home Care", "Others"],
  "Retail Trade": ["E-commerce", "Supermarkets", "Department Stores", "Specialty Retail", "Others"],
  "Information & Communication": ["Software", "IT Services", "Telecommunications", "Media", "Others"],
  "Financial Services": ["Banking", "Insurance", "Investment", "Fintech", "Others"],
  "Transportation & Logistics": ["Shipping", "Aviation", "Railways", "Road Transport", "Warehousing", "Others"],
  "Electricity & Gas": ["Power Generation", "Distribution", "Renewable Energy", "Gas Supply", "Others"],
  "Services": ["Consulting", "Professional Services", "Healthcare", "Education", "Hospitality", "Others"],
  "Construction & Infrastructure": ["Real Estate Development", "Infrastructure", "Engineering", "Others"],
  "Real Estate": ["Residential", "Commercial", "Industrial", "Others"],
  "Media & Entertainment": ["Broadcasting", "Publishing", "Digital Media", "Entertainment", "Others"],
  "Others": ["Others"],
};

export default function Accounts() {
  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editAccountData, setEditAccountData] = useState<any>(null);
  const [updatingAccount, setUpdatingAccount] = useState(false);
  const [retentionTypes, setRetentionTypes] = useState<Array<{ retention_type: string | null; count: number }>>([]);
  const [pipelineDeals, setPipelineDeals] = useState<any[]>([]);
  const [loadingRetentionData, setLoadingRetentionData] = useState(false);
  const [loadingPipelineData, setLoadingPipelineData] = useState(false);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<{ rowNumber: number; data: Record<string, any>; isValid: boolean; errors: string[] }>>([]);
  const [csvFileToUpload, setCsvFileToUpload] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<AccountFormData>({
    name: "",
    website: "",
    address: "",
    city: "",
    state: "",
    country: "",
    foundedYear: "",
    industry: "",
    subCategory: "",
    revenueRange: "",
    totalACV: "0",
    totalMCV: "0",
    mcvTier: "",
    companySizeTier: "",
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterRevenue, setFilterRevenue] = useState("");
  const [filterMCVTier, setFilterMCVTier] = useState("");
  const [filterCompanyTier, setFilterCompanyTier] = useState("");
  const [filterYearMin, setFilterYearMin] = useState("");
  const [filterYearMax, setFilterYearMax] = useState("");

  const { toast } = useToast();

  // Update sub-categories when industry changes
  useEffect(() => {
    if (formData.industry && industrySubCategories[formData.industry]) {
      setFormData((prev) => ({
        ...prev,
        subCategory: "",
      }));
    }
  }, [formData.industry]);

  // Auto-calculate Company Size Tier based on revenue range
  useEffect(() => {
    if (formData.revenueRange) {
      const isTier1 = formData.revenueRange.includes("500CR") || formData.revenueRange.includes("100~500CR");
      setFormData((prev) => ({
        ...prev,
        companySizeTier: isTier1 ? "Tier 1" : "Tier 2",
      }));
    }
  }, [formData.revenueRange]);

  const handleInputChange = (field: keyof AccountFormData, value: string) => {
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
        throw new Error("You must be logged in to create an account");
      }

      const accountData = {
        name: formData.name,
        website: formData.website,
        address: formData.address,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || null,
        founded_year: parseInt(formData.foundedYear),
        industry: formData.industry,
        sub_category: formData.subCategory,
        revenue_range: formData.revenueRange,
        total_acv: 0, // Will be calculated from mandates
        total_mcv: 0, // Will be calculated from mandates
        mcv_tier: null, // Will be calculated from mandates
        company_size_tier: formData.companySizeTier || null,
        created_by: user.id,
      };

      const { error: insertError } = await supabase
        .from("accounts")
        .insert([accountData]);

      if (insertError) throw insertError;

      toast({
        title: "Success!",
        description: "Account saved successfully.",
      });

      // Reset form
      setFormData({
        name: "",
        website: "",
        address: "",
        city: "",
        state: "",
        country: "",
        foundedYear: "",
        industry: "",
        subCategory: "",
        revenueRange: "",
        totalACV: "0",
        totalMCV: "0",
        mcvTier: "",
        companySizeTier: "",
      });

      // Close dialog and refresh accounts list
      setFormDialogOpen(false);
      fetchAccounts();
    } catch (error: any) {
      console.error("Error saving account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching accounts:", error);
        // If table doesn't exist, show empty array instead of error
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          console.warn("Accounts table does not exist. Please run the migration.");
          setAccounts([]);
          toast({
            title: "Info",
            description: "Accounts table not found. Please run the database migration.",
            variant: "default",
          });
          return;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        setAccounts([]);
        return;
      }

      // Calculate Total ACV and MCV from mandates for each account (if mandates table exists)
      let accountsWithTotals = data;
      
      try {
        // Try to fetch mandates and calculate totals
        accountsWithTotals = await Promise.all(
          data.map(async (account) => {
            try {
              const { data: mandates, error: mandatesError } = await supabase
                .from("mandates")
                .select("revenue_acv, revenue_mcv")
                .eq("account_id", account.id);

              // If mandates table doesn't exist, just return account as-is
              if (mandatesError && (mandatesError.code === "42P01" || mandatesError.message.includes("does not exist"))) {
                return account;
              }

              const totalACV = mandates?.reduce((sum, m) => sum + (parseFloat(String(m.revenue_acv || 0)) || 0), 0) || 0;
              const totalMCV = mandates?.reduce((sum, m) => sum + (parseFloat(String(m.revenue_mcv || 0)) || 0), 0) || 0;
              const mcvTier = totalMCV >= 1000000 ? "Tier 1" : totalMCV > 0 ? "Tier 2" : null;

              // Update account in database with calculated values (only if values changed)
              if (account.total_acv !== totalACV || account.total_mcv !== totalMCV || account.mcv_tier !== mcvTier) {
                try {
                  await supabase
                    .from("accounts")
                    .update({
                      total_acv: totalACV,
                      total_mcv: totalMCV,
                      mcv_tier: mcvTier,
                    })
                    .eq("id", account.id);
                } catch (updateErr) {
                  // Ignore update errors
                  console.warn("Error updating account totals:", updateErr);
                }
              }

              return {
                ...account,
                total_acv: totalACV,
                total_mcv: totalMCV,
                mcv_tier: mcvTier,
              };
            } catch (err) {
              // If error calculating, just return account as-is
              console.warn("Error calculating totals for account:", err);
              return account;
            }
          })
        );
      } catch (err) {
        // If mandates table doesn't exist or other error, just use accounts as-is
        console.warn("Error calculating totals from mandates:", err);
        accountsWithTotals = data;
      }

      setAccounts(accountsWithTotals);
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
      toast({
        title: "Error",
        description: error.message || "Failed to load accounts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (viewMode === "view") {
      console.log("View mode changed to 'view', fetching accounts...");
      fetchAccounts();
    }
  }, [viewMode]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterIndustry("");
    setFilterRevenue("");
    setFilterMCVTier("");
    setFilterCompanyTier("");
    setFilterYearMin("");
    setFilterYearMax("");
  };

  const filteredAccounts = (accounts || []).filter((account) => {
    if (!account) return false;
    
    const matchesSearch =
      account.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.website?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.country?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = !filterIndustry || account.industry === filterIndustry;
    const matchesRevenue = !filterRevenue || account.revenue_range === filterRevenue;
    const matchesMCVTier = !filterMCVTier || account.mcv_tier === filterMCVTier;
    const matchesCompanyTier = !filterCompanyTier || account.company_size_tier === filterCompanyTier;
    const matchesYearMin = !filterYearMin || (account.founded_year && account.founded_year >= parseInt(filterYearMin));
    const matchesYearMax = !filterYearMax || (account.founded_year && account.founded_year <= parseInt(filterYearMax));

    return matchesSearch && matchesIndustry && matchesRevenue && matchesMCVTier && matchesCompanyTier && matchesYearMin && matchesYearMax;
  });

  const handleViewDetails = async (account: any) => {
    setSelectedAccount(account);
    setEditAccountData({
      name: account.name,
      website: account.website,
      address: account.address || "",
      city: account.city || "",
      state: account.state || "",
      country: account.country || "",
      foundedYear: account.founded_year?.toString() || "",
      industry: account.industry || "",
      subCategory: account.sub_category || "",
      revenueRange: account.revenue_range || "",
    });
    setIsEditMode(false);
    setDetailsModalOpen(true);
    
    // Fetch retention types and pipeline deals for this account
    if (account.id) {
      fetchRetentionTypes(account.id);
      fetchPipelineDeals(account.id);
    }
  };

  const fetchRetentionTypes = async (accountId: string) => {
    setLoadingRetentionData(true);
    try {
      const { data, error } = await supabase
        .from("mandates")
        .select("retention_type")
        .eq("account_id", accountId);

      if (error) {
        console.error("Error fetching retention types:", error);
        setRetentionTypes([]);
        return;
      }

      // Group by retention_type and count (treat null as "NI")
      const grouped = (data || []).reduce((acc: Record<string, number>, mandate: any) => {
        const type = mandate.retention_type || "NI";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      // Convert to array and sort
      const retentionArray = Object.entries(grouped).map(([retention_type, count]) => ({
        retention_type,
        count: count as number,
      }));

      // Sort by retention type (STAR, A, B, C, D, E, NI)
      const order = ["STAR", "A", "B", "C", "D", "E", "NI"];
      retentionArray.sort((a, b) => {
        const aIndex = order.indexOf(a.retention_type);
        const bIndex = order.indexOf(b.retention_type);
        if (aIndex === -1 && bIndex === -1) return a.retention_type.localeCompare(b.retention_type);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      setRetentionTypes(retentionArray);
    } catch (error) {
      console.error("Error fetching retention types:", error);
      setRetentionTypes([]);
    } finally {
      setLoadingRetentionData(false);
    }
  };

  const fetchPipelineDeals = async (accountId: string) => {
    setLoadingPipelineData(true);
    try {
      const { data, error } = await supabase
        .from("pipeline_deals")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pipeline deals:", error);
        setPipelineDeals([]);
        return;
      }

      setPipelineDeals(data || []);
    } catch (error) {
      console.error("Error fetching pipeline deals:", error);
      setPipelineDeals([]);
    } finally {
      setLoadingPipelineData(false);
    }
  };

  const handleDownloadAccountTemplate = () => {
    // Exclude auto-calculated fields: total_acv, total_mcv, mcv_tier, company_size_tier
    const templateHeaders = [
      { key: "name", label: "Account Name" },
      { key: "website", label: "Website" },
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "country", label: "Country" },
      { key: "founded_year", label: "Founded Year" },
      { key: "industry", label: "Industry" },
      { key: "sub_category", label: "Sub Category" },
      { key: "revenue_range", label: "Revenue Range" },
    ];
    downloadCSVTemplate(templateHeaders, "accounts_upload_template.csv");
    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded. Fill in the data and upload it.",
    });
  };

  const handleBulkUploadAccounts = async (file: File) => {
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

      // Parse and validate each row
      const previewRows = csvData.map((row: any, index: number) => {
        const rowNumber = index + 2; // +2 because CSV has header and is 1-indexed
        const errors: string[] = [];

        // Validate required fields
        if (!row["Account Name"] || row["Account Name"].trim() === "") {
          errors.push("Account Name is required");
        }
        if (!row["Website"] || row["Website"].trim() === "") {
          errors.push("Website is required");
        }
        if (!row["Address"] || row["Address"].trim() === "") {
          errors.push("Address is required");
        }
        if (!row["Founded Year"] || isNaN(parseInt(row["Founded Year"]))) {
          errors.push("Founded Year must be a valid number");
        }
        if (!row["Industry"] || row["Industry"].trim() === "") {
          errors.push("Industry is required");
        }
        if (!row["Sub Category"] || row["Sub Category"].trim() === "") {
          errors.push("Sub Category is required");
        }
        if (!row["Revenue Range"] || row["Revenue Range"].trim() === "") {
          errors.push("Revenue Range is required");
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
      setLoadingAccounts(true);
      setCsvPreviewOpen(false);

      const text = await csvFileToUpload.text();
      const csvData = parseCSV(text);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to upload accounts");
      }

      // Filter out invalid rows
      const validRows = csvData.filter((row: any, index: number) => {
        const previewRow = csvPreviewRows[index];
        return previewRow?.isValid;
      });

      const accountsToInsert = validRows.map((row: any) => {
        // Auto-calculate company_size_tier from revenue_range
        let companySizeTier = null;
        if (row["Revenue Range"]) {
          const revenueRange = row["Revenue Range"];
          const isTier1 = revenueRange.includes("500CR") || revenueRange.includes("100~500CR");
          companySizeTier = isTier1 ? "Tier 1" : "Tier 2";
        }

        return {
          name: row["Account Name"] || "",
          website: row["Website"] || "",
          address: row["Address"] || "",
          city: row["City"] || "",
          state: row["State"] || "",
          country: row["Country"] || "",
          founded_year: parseInt(row["Founded Year"]) || null,
          industry: row["Industry"] || "",
          sub_category: row["Sub Category"] || "",
          revenue_range: row["Revenue Range"] || "",
          total_acv: 0, // Will be calculated from mandates
          total_mcv: 0, // Will be calculated from mandates
          mcv_tier: null, // Will be calculated from mandates
          company_size_tier: companySizeTier,
          created_by: user.id,
        };
      });

      // Upsert accounts in batches (update if name + industry exists, insert if new)
      const batchSize = 50;
      let successCount = 0;
      let updateCount = 0;
      let insertCount = 0;
      let errorCount = 0;

      // Get all account names and industries to check which ones exist
      const accountNameIndustryPairs = accountsToInsert.map((a: any) => ({
        name: a.name,
        industry: a.industry,
      }));

      // Fetch existing accounts with matching name and industry
      const { data: existingAccounts } = await supabase
        .from("accounts")
        .select("id, name, industry");

      const existingAccountMap: Record<string, string> = {};
      existingAccounts?.forEach((acc: any) => {
        const key = `${acc.name}|||${acc.industry}`;
        existingAccountMap[key] = acc.id;
      });

      for (let i = 0; i < accountsToInsert.length; i += batchSize) {
        const batch = accountsToInsert.slice(i, i + batchSize);
        
        // Separate into updates and inserts
        const toUpdate: any[] = [];
        const toInsert: any[] = [];

        batch.forEach((account: any) => {
          const key = `${account.name}|||${account.industry}`;
          const existingId = existingAccountMap[key];
          if (existingId) {
            // Update existing
            toUpdate.push({ ...account, id: existingId });
          } else {
            // Insert new
            toInsert.push(account);
          }
        });

        // Update existing accounts
        for (const account of toUpdate) {
          const { id, ...updateData } = account;
          const { error } = await supabase
            .from("accounts")
            .update(updateData)
            .eq("id", id);
          
          if (error) {
            console.error("Error updating account:", error);
            errorCount++;
          } else {
            updateCount++;
            successCount++;
          }
        }

        // Insert new accounts
        if (toInsert.length > 0) {
          const { error } = await supabase.from("accounts").insert(toInsert);
          
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
        description: `Successfully processed ${successCount} accounts (${insertCount} inserted, ${updateCount} updated). ${errorCount > 0 ? `${errorCount} failed.` : ""}`,
      });

      // Reset preview state
      setCsvPreviewRows([]);
      setCsvFileToUpload(null);

      // Refresh accounts list
      fetchAccounts();
    } catch (error: any) {
      console.error("Error uploading accounts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload accounts. Please check the CSV format.",
        variant: "destructive",
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleCancelUpload = () => {
    setCsvPreviewOpen(false);
    setCsvPreviewRows([]);
    setCsvFileToUpload(null);
  };

  const handleExportAccounts = async () => {
    try {
      setLoadingAccounts(true);
      
      // Fetch all accounts (not just filtered ones)
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No data",
          description: "No accounts found to export.",
          variant: "default",
        });
        return;
      }

      // Prepare data for CSV with all fields
      const csvData = data.map((account) => ({
        id: account.id,
        name: account.name || "",
        website: account.website || "",
        address: account.address || "",
        city: account.city || "",
        state: account.state || "",
        country: account.country || "",
        founded_year: account.founded_year || "",
        industry: account.industry || "",
        sub_category: account.sub_category || "",
        revenue_range: account.revenue_range || "",
        total_acv: account.total_acv || 0,
        total_mcv: account.total_mcv || 0,
        mcv_tier: account.mcv_tier || "",
        company_size_tier: account.company_size_tier || "",
        created_at: formatTimestampForCSV(account.created_at),
        updated_at: formatTimestampForCSV(account.updated_at),
        created_by: account.created_by || "",
      }));

      const csvContent = convertToCSV(csvData);
      const filename = `accounts_export_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCSV(csvContent, filename);

      toast({
        title: "Success!",
        description: `Exported ${csvData.length} accounts to CSV.`,
      });
    } catch (error: any) {
      console.error("Error exporting accounts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to export accounts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;
    
    setUpdatingAccount(true);
    try {
      const updateData: any = {
        name: editAccountData.name,
        website: editAccountData.website,
        address: editAccountData.address,
        city: editAccountData.city || null,
        state: editAccountData.state || null,
        country: editAccountData.country || null,
        founded_year: parseInt(editAccountData.foundedYear) || null,
        industry: editAccountData.industry || null,
        sub_category: editAccountData.subCategory || null,
        revenue_range: editAccountData.revenueRange || null,
      };

      // Auto-calculate Company Size Tier based on revenue range
      if (editAccountData.revenueRange) {
        const isTier1 = editAccountData.revenueRange.includes("500CR") || editAccountData.revenueRange.includes("100~500CR");
        updateData.company_size_tier = isTier1 ? "Tier 1" : "Tier 2";
      }

      const { error } = await supabase
        .from("accounts")
        .update(updateData)
        .eq("id", selectedAccount.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Account updated successfully.",
      });

      setIsEditMode(false);
      setDetailsModalOpen(false);
      fetchAccounts();
    } catch (error: any) {
      console.error("Error updating account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingAccount(false);
    }
  };

  const industries = [
    "Manufacturing",
    "FMCG",
    "Retail Trade",
    "Information & Communication",
    "Financial Services",
    "Transportation & Logistics",
    "Electricity & Gas",
    "Services",
    "Construction & Infrastructure",
    "Real Estate",
    "Media & Entertainment",
    "Others",
  ];

  const revenueRanges = [
    "~10CR",
    "10CR~50CR",
    "50CR~100CR",
    "100~500CR",
    "500CR &above",
  ];

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your customer accounts and relationships.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportAccounts}
            disabled={loadingAccounts}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadAccountTemplate}
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
                  handleBulkUploadAccounts(file);
                }
                // Reset input
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              asChild
              disabled={loadingAccounts}
            >
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </span>
            </Button>
          </label>
          <Button onClick={() => setFormDialogOpen(true)}>
            Add Account
          </Button>
        </div>
      </div>

      {/* Add / Edit Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => {
        setFormDialogOpen(open);
        if (!open) {
          // Reset form when dialog closes
          setFormData({
            name: "",
            website: "",
            address: "",
            city: "",
            state: "",
            country: "",
            foundedYear: "",
            industry: "",
            subCategory: "",
            revenueRange: "",
            totalACV: "0",
            totalMCV: "0",
            mcvTier: "",
            companySizeTier: "",
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1st Section: General Information */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 text-blue-900">General Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Acme Pvt Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">
                      Website <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange("website", e.target.value)}
                      placeholder="https://example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">
                      Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      placeholder="Street address"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">
                      City <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      placeholder="City"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">
                      State <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange("state", e.target.value)}
                      placeholder="State"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">
                      Country <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      placeholder="Country"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foundedYear">
                      Founded Year <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="foundedYear"
                      type="number"
                      min="1800"
                      max="2100"
                      value={formData.foundedYear}
                      onChange={(e) => handleInputChange("foundedYear", e.target.value)}
                      placeholder="2010"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2nd Section: Industry Classification */}
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 text-green-900">Industry Classification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">
                      Industry <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.industry}
                      onValueChange={(value) => handleInputChange("industry", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subCategory">
                      Industry - Sub Category <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.subCategory}
                      onValueChange={(value) => handleInputChange("subCategory", value)}
                      required
                      disabled={!formData.industry}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.industry && industrySubCategories[formData.industry] ? (
                          industrySubCategories[formData.industry].map((subCat) => (
                            <SelectItem key={subCat} value={subCat}>
                              {subCat}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Select industry first
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenueRange">
                      Company Size 1 (Revenue Range) <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.revenueRange}
                      onValueChange={(value) => handleInputChange("revenueRange", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {revenueRanges.map((range) => (
                          <SelectItem key={range} value={range}>
                            {range}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      name: "",
                      website: "",
                      address: "",
                      city: "",
                      state: "",
                      country: "",
                      foundedYear: "",
                      industry: "",
                      subCategory: "",
                      revenueRange: "",
                      totalACV: "0",
                      totalMCV: "0",
                      mcvTier: "",
                      companySizeTier: "",
                    });
                  }}
                >
                  Clear
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Account"
                  )}
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* View Data Table */}
      {viewMode === "view" && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <Input
                  placeholder="Search by Account Name / Website / Address / City / State / Country"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Select value={filterIndustry || "all"} onValueChange={(value) => setFilterIndustry(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterRevenue || "all"} onValueChange={(value) => setFilterRevenue(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Revenue Ranges" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Revenue Ranges</SelectItem>
                    {revenueRanges.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterMCVTier || "all"} onValueChange={(value) => setFilterMCVTier(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All MCV Tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All MCV Tiers</SelectItem>
                    <SelectItem value="Tier 1">Tier 1</SelectItem>
                    <SelectItem value="Tier 2">Tier 2</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCompanyTier || "all"} onValueChange={(value) => setFilterCompanyTier(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Company Size Tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Company Size Tiers</SelectItem>
                    <SelectItem value="Tier 1">Tier 1</SelectItem>
                    <SelectItem value="Tier 2">Tier 2</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Founded Year ≥"
                  value={filterYearMin}
                  onChange={(e) => setFilterYearMin(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Founded Year ≤"
                  value={filterYearMax}
                  onChange={(e) => setFilterYearMax(e.target.value)}
                />
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
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
                      <TableHead>Account Name</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Founded Year</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Sub Category</TableHead>
                      <TableHead>Revenue Range</TableHead>
                      <TableHead>Total ACV</TableHead>
                      <TableHead>Total MCV</TableHead>
                      <TableHead>MCV Tier</TableHead>
                      <TableHead>Company Size Tier</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAccounts ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground">Loading accounts...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                          No accounts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.name}</TableCell>
                          <TableCell>
                            <a
                              href={account.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {account.website}
                            </a>
                          </TableCell>
                          <TableCell>{account.address}</TableCell>
                          <TableCell>{account.city || "N/A"}</TableCell>
                          <TableCell>{account.state || "N/A"}</TableCell>
                          <TableCell>{account.country || "N/A"}</TableCell>
                          <TableCell>{account.founded_year}</TableCell>
                          <TableCell>{account.industry}</TableCell>
                          <TableCell>{account.sub_category}</TableCell>
                          <TableCell>{account.revenue_range}</TableCell>
                          <TableCell>
                            {account.total_acv ? account.total_acv.toLocaleString("en-IN") : "0"}
                          </TableCell>
                          <TableCell>
                            {account.total_mcv ? account.total_mcv.toLocaleString("en-IN") : "0"}
                          </TableCell>
                          <TableCell>{account.mcv_tier || "N/A"}</TableCell>
                          <TableCell>{account.company_size_tier || "N/A"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(account)}
                            >
                              View Details
                            </Button>
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
      )}

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={(open) => {
        setDetailsModalOpen(open);
        if (!open) {
          setIsEditMode(false);
          setRetentionTypes([]);
          setPipelineDeals([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAccount?.name || "Account Details"}</DialogTitle>
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
                  setEditAccountData({
                    name: selectedAccount.name,
                    website: selectedAccount.website,
                    address: selectedAccount.address || "",
                    city: selectedAccount.city || "",
                    state: selectedAccount.state || "",
                    country: selectedAccount.country || "",
                    foundedYear: selectedAccount.founded_year?.toString() || "",
                    industry: selectedAccount.industry || "",
                    subCategory: selectedAccount.sub_category || "",
                    revenueRange: selectedAccount.revenue_range || "",
                  });
                }}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateAccount} disabled={updatingAccount}>
                  {updatingAccount ? (
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
          {selectedAccount && editAccountData && (
            <div className="space-y-6">
              {/* 1st Section: General Information */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">General Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Account Name:</Label>
                      {isEditMode ? (
                        <Input
                          value={editAccountData.name}
                          onChange={(e) => setEditAccountData({ ...editAccountData, name: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedAccount.name || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Website:</Label>
                      {isEditMode ? (
                        <Input
                          value={editAccountData.website}
                          onChange={(e) => setEditAccountData({ ...editAccountData, website: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedAccount.website || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-medium text-muted-foreground">Address:</Label>
                      {isEditMode ? (
                        <Input
                          value={editAccountData.address}
                          onChange={(e) => setEditAccountData({ ...editAccountData, address: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedAccount.address || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">City:</Label>
                      {isEditMode ? (
                        <Input
                          value={editAccountData.city}
                          onChange={(e) => setEditAccountData({ ...editAccountData, city: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedAccount.city || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">State:</Label>
                      {isEditMode ? (
                        <Input
                          value={editAccountData.state}
                          onChange={(e) => setEditAccountData({ ...editAccountData, state: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedAccount.state || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Country:</Label>
                      {isEditMode ? (
                        <Input
                          value={editAccountData.country}
                          onChange={(e) => setEditAccountData({ ...editAccountData, country: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedAccount.country || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Founded Year:</Label>
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={editAccountData.foundedYear}
                          onChange={(e) => setEditAccountData({ ...editAccountData, foundedYear: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedAccount.founded_year || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Section: Industry Classification */}
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Industry Classification</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Industry:</Label>
                      {isEditMode ? (
                        <Select
                          value={editAccountData.industry}
                          onValueChange={(value) => {
                            setEditAccountData({ ...editAccountData, industry: value, subCategory: "" });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            {industries.map((industry) => (
                              <SelectItem key={industry} value={industry}>
                                {industry}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedAccount.industry || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Sub Category:</Label>
                      {isEditMode ? (
                        <Select
                          value={editAccountData.subCategory}
                          onValueChange={(value) => setEditAccountData({ ...editAccountData, subCategory: value })}
                          disabled={!editAccountData.industry}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select sub category" />
                          </SelectTrigger>
                          <SelectContent>
                            {editAccountData.industry && industrySubCategories[editAccountData.industry] ? (
                              industrySubCategories[editAccountData.industry].map((subCat) => (
                                <SelectItem key={subCat} value={subCat}>
                                  {subCat}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                Select industry first
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedAccount.sub_category || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Revenue Range:</Label>
                      {isEditMode ? (
                        <Select
                          value={editAccountData.revenueRange}
                          onValueChange={(value) => setEditAccountData({ ...editAccountData, revenueRange: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select revenue range" />
                          </SelectTrigger>
                          <SelectContent>
                            {revenueRanges.map((range) => (
                              <SelectItem key={range} value={range}>
                                {range}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedAccount.revenue_range || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3rd Section: Financial Metrics */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Financial Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium text-muted-foreground">Total ACV:</Label>
                      <p className="mt-1">{selectedAccount.total_acv?.toLocaleString("en-IN") || "0"}</p>
                    </div>
                    <div>
                      <Label className="font-medium text-muted-foreground">Total MCV:</Label>
                      <p className="mt-1">{selectedAccount.total_mcv?.toLocaleString("en-IN") || "0"}</p>
                    </div>
                    <div>
                      <Label className="font-medium text-muted-foreground">MCV Tier:</Label>
                      <p className="mt-1">{selectedAccount.mcv_tier || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="font-medium text-muted-foreground">Company Size Tier:</Label>
                      <p className="mt-1">{selectedAccount.company_size_tier || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4th Section: Mandates per Retention Type */}
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-orange-900">Mandates per Retention Type</h3>
                  <div className="overflow-x-auto">
                    {loadingRetentionData ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-muted-foreground">Loading retention data...</span>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Retention Type</TableHead>
                            <TableHead>Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {retentionTypes.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                No retention data available
                              </TableCell>
                            </TableRow>
                          ) : (
                            retentionTypes.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.retention_type || "NI"}</TableCell>
                                <TableCell>{item.count}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    (Linked to mandates; will populate when mandate data source is connected.)
                  </p>
                </CardContent>
              </Card>

              {/* 5th Section: Cross Sell Deals */}
              <Card className="border-teal-200 bg-teal-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-teal-900">Cross Sell Deals</h3>
                  <div className="overflow-x-auto">
                    {loadingPipelineData ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-muted-foreground">Loading pipeline deals...</span>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vertical</TableHead>
                            <TableHead>Line of Business</TableHead>
                            <TableHead>Use Case</TableHead>
                            <TableHead>Sub Use Case</TableHead>
                            <TableHead>Expected Revenue</TableHead>
                            <TableHead>MPV</TableHead>
                            <TableHead>Max MPV</TableHead>
                            <TableHead>Monthly Volume</TableHead>
                            <TableHead>Max Monthly Volume</TableHead>
                            <TableHead>Commercial / head-task</TableHead>
                            <TableHead>PRJ months</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pipelineDeals.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={12} className="text-center text-muted-foreground py-4">
                                No pipeline deals found
                              </TableCell>
                            </TableRow>
                          ) : (
                            pipelineDeals.map((deal) => (
                              <TableRow key={deal.id}>
                                <TableCell>N/A</TableCell>
                                <TableCell>{deal.lob || "N/A"}</TableCell>
                                <TableCell>{deal.use_case || "N/A"}</TableCell>
                                <TableCell>{deal.sub_use_case || "N/A"}</TableCell>
                                <TableCell>
                                  {deal.expected_revenue
                                    ? parseFloat(String(deal.expected_revenue)).toLocaleString("en-IN")
                                    : "0"}
                                </TableCell>
                                <TableCell>
                                  {deal.mpv ? parseFloat(String(deal.mpv)).toLocaleString("en-IN") : "0"}
                                </TableCell>
                                <TableCell>
                                  {deal.max_mpv
                                    ? parseFloat(String(deal.max_mpv)).toLocaleString("en-IN")
                                    : "0"}
                                </TableCell>
                                <TableCell>
                                  {deal.monthly_volume
                                    ? parseFloat(String(deal.monthly_volume)).toLocaleString("en-IN")
                                    : "0"}
                                </TableCell>
                                <TableCell>
                                  {deal.max_monthly_volume
                                    ? parseFloat(String(deal.max_monthly_volume)).toLocaleString("en-IN")
                                    : "0"}
                                </TableCell>
                                <TableCell>
                                  {deal.commercial_per_head
                                    ? parseFloat(String(deal.commercial_per_head)).toLocaleString("en-IN")
                                    : "0"}
                                </TableCell>
                                <TableCell>{deal.prj_duration_months || "N/A"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{deal.status || "N/A"}</Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Totals above are auto-calculated: ACV = Σ(Expected Revenue), MCV = Σ(MPV).
                  </p>
                </CardContent>
              </Card>
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
        loading={loadingAccounts}
        title="Preview Accounts CSV Upload"
      />
    </div>
  );
}
