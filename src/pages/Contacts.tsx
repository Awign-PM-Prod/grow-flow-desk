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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Upload, FileText } from "lucide-react";
import { convertToCSV, downloadCSV, formatTimestampForCSV, downloadCSVTemplate, parseCSV } from "@/lib/csv-export";
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

interface ContactFormData {
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  department: string;
  kra: string;
  title: string;
  level: string;
  zone: string;
  region: string;
  reportsTo: string;
  positioning: string;
  awignChampion: string;
}

export default function Contacts() {
  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [accountContacts, setAccountContacts] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loadingAccountContacts, setLoadingAccountContacts] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContactData, setEditContactData] = useState<any>(null);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [editAccountContacts, setEditAccountContacts] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<{ rowNumber: number; data: Record<string, any>; isValid: boolean; errors: string[] }>>([]);
  const [csvFileToUpload, setCsvFileToUpload] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);

  // Filters for view mode
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterTitle, setFilterTitle] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterAwignChampion, setFilterAwignChampion] = useState("all");

  // Search terms for dropdowns in forms
  const [accountSearch, setAccountSearch] = useState("");
  const [reportsToSearch, setReportsToSearch] = useState("");
  const [editAccountSearch, setEditAccountSearch] = useState("");
  const [editReportsToSearch, setEditReportsToSearch] = useState("");

  const [formData, setFormData] = useState<ContactFormData>({
    accountId: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    department: "",
    kra: "",
    title: "",
    level: "",
    zone: "",
    region: "",
    reportsTo: "",
    positioning: "",
    awignChampion: "",
  });

  const { toast } = useToast();

  // Fetch accounts for dropdown
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from("accounts")
          .select("id, name")
          .order("name");

        if (error) throw error;
        setAccounts(data || []);
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };

    fetchAccounts();
  }, []);

  // Fetch contacts for selected account
  useEffect(() => {
    const fetchAccountContacts = async () => {
      if (!formData.accountId) {
        setAccountContacts([]);
        // Reset reportsTo when account is cleared
        setFormData((prev) => ({ ...prev, reportsTo: "" }));
        return;
      }

      setLoadingAccountContacts(true);
      try {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("account_id", formData.accountId)
          .order("first_name");

        if (error) throw error;
        setAccountContacts(data || []);
        // Reset reportsTo when account changes
        setFormData((prev) => ({ ...prev, reportsTo: "" }));
      } catch (error) {
        console.error("Error fetching account contacts:", error);
        setAccountContacts([]);
      } finally {
        setLoadingAccountContacts(false);
      }
    };

    fetchAccountContacts();
  }, [formData.accountId]);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("You must be logged in to create a contact");
      }

      const contactData = {
        account_id: formData.accountId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phoneNumber,
        department: formData.department,
        kra: sanitizeValue(formData.kra),
        title: formData.title,
        level: ensureEnumValue(formData.level, ['Lv.1', 'Lv.2', 'Lv.3']) || formData.level,
        zone: formData.zone,
        region: formData.zone === "Regional" ? sanitizeValue(formData.region) : null,
        reports_to: sanitizeValue(formData.reportsTo),
        positioning: formData.positioning,
        awign_champion: formData.awignChampion === "YES",
        created_by: user.id,
      };

      const { error: insertError } = await supabase
        .from("contacts")
        .insert([contactData]);

      if (insertError) throw insertError;

      toast({
        title: "Success!",
        description: "Contact saved successfully.",
      });

      // Reset form
      setFormData({
        accountId: "",
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        department: "",
        kra: "",
        title: "",
        level: "",
        zone: "",
        region: "",
        reportsTo: "",
        positioning: "",
        awignChampion: "",
      });

      // Close dialog and refresh contacts list
      setFormDialogOpen(false);
      fetchContacts();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save contact. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch account names separately
      const accountIds = [...new Set((data || []).map((c: any) => c.account_id).filter(Boolean))];
      const accountMap: Record<string, string> = {};

      if (accountIds.length > 0) {
        const { data: accountData } = await supabase
          .from("accounts")
          .select("id, name")
          .in("id", accountIds);

        if (accountData) {
          accountData.forEach((acc) => {
            accountMap[acc.id] = acc.name;
          });
        }
      }

      // Add account names to contacts
      const contactsWithAccounts = (data || []).map((contact: any) => ({
        ...contact,
        accountName: accountMap[contact.account_id] || "N/A",
      }));

      setContacts(contactsWithAccounts);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleDownloadContactTemplate = () => {
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
      { key: "account_name", label: "Account Name" },
      { key: "first_name", label: "First Name" },
      { key: "last_name", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "phone_number", label: "Phone Number" },
      { key: "department", label: "Department" },
      { key: "kra", label: "KRA" },
      { key: "title", label: "Title" },
      { key: "level", label: "Level" },
      { key: "zone", label: "Zone" },
      { key: "region", label: "Region" },
      { key: "reports_to", label: "Reports To" },
      { key: "positioning", label: "Positioning" },
      { key: "awign_champion", label: "Awign Champion" },
      { key: "gap1", label: "" },
      { key: "gap2", label: "" },
      { key: "reference_awign_champion", label: "Reference Awign Champion" },
      { key: "reference_level", label: "Reference Level" },
    ];
    
    // Create header row
    const headerRow = templateHeaders.map((h) => escapeCSVValue(h.label)).join(",");
    
    // Create reference data rows showing Awign Champion and Level options
    const referenceRows: string[] = [];
    
    // Add empty row for spacing
    referenceRows.push(templateHeaders.map(() => "").join(","));
    
    // Add header row for reference section
    const referenceHeaderRow = [
      ...Array(14).fill(""), // Empty columns for data fields (14 fields before gaps)
      "", "", // 2 empty columns for gap
      "=== REFERENCE: Awign Champion Options ===",
      "=== REFERENCE: Level Options ===",
    ].join(",");
    referenceRows.push(referenceHeaderRow);
    
    // Add empty row after header
    referenceRows.push(templateHeaders.map((h, i) => {
      if (i < 14) return ""; // Data fields
      if (i === 14 || i === 15) return ""; // Gap columns before references
      if (i === 16) return "Awign Champion";
      if (i === 17) return "Level";
      return "";
    }).join(","));
    
    // Add YES and NO options for Awign Champion
    const yesRow = [
      ...Array(14).fill(""), // Empty columns for data fields
      "", "", // 2 empty columns for gap
      "YES",
      "" // Empty for Level
    ].join(",");
    referenceRows.push(yesRow);
    
    const noRow = [
      ...Array(14).fill(""), // Empty columns for data fields
      "", "", // 2 empty columns for gap
      "NO",
      "" // Empty for Level
    ].join(",");
    referenceRows.push(noRow);
    
    // Add empty row before Level reference section
    referenceRows.push(templateHeaders.map(() => "").join(","));
    
    // Add Level options (Lv.1, Lv.2, Lv.3)
    const level1Row = [
      ...Array(14).fill(""), // Empty columns for data fields
      "", "", // 2 empty columns for gap
      "", // Empty for Awign Champion
      "Lv.1"
    ].join(",");
    referenceRows.push(level1Row);
    
    const level2Row = [
      ...Array(14).fill(""), // Empty columns for data fields
      "", "", // 2 empty columns for gap
      "", // Empty for Awign Champion
      "Lv.2"
    ].join(",");
    referenceRows.push(level2Row);
    
    const level3Row = [
      ...Array(14).fill(""), // Empty columns for data fields
      "", "", // 2 empty columns for gap
      "", // Empty for Awign Champion
      "Lv.3"
    ].join(",");
    referenceRows.push(level3Row);
    
    const csvContent = [headerRow, ...referenceRows].join("\n");
    downloadCSV(csvContent, "contacts_upload_template.csv");
    
    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded. Fill in the data and upload it. Reference data included on the right.",
    });
  };

  const handleBulkUploadContacts = async (file: File) => {
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

      // Parse and validate each row
      const previewRows = csvData.map((row: any, index: number) => {
        const rowNumber = index + 2; // +2 because CSV has header and is 1-indexed
        const errors: string[] = [];
        const accountName = row["Account Name"];

        // Validate lookup fields
        if (accountName && !accountMap[accountName]) {
          errors.push(`Account "${accountName}" does not exist`);
        }

        if (!accountName || accountName.trim() === "") {
          errors.push("Account Name is required");
        }

        // Validate required fields
        if (!row["First Name"] || row["First Name"].trim() === "") {
          errors.push("First Name is required");
        }
        if (!row["Last Name"] || row["Last Name"].trim() === "") {
          errors.push("Last Name is required");
        }
        if (!row["Email"] || row["Email"].trim() === "") {
          errors.push("Email is required");
        }
        if (!row["Phone Number"] || row["Phone Number"].trim() === "") {
          errors.push("Phone Number is required");
        }
        if (!row["Department"] || row["Department"].trim() === "") {
          errors.push("Department is required");
        }
        if (!row["Title"] || row["Title"].trim() === "") {
          errors.push("Title is required");
        }
        // Validate Level (must be Lv.1, Lv.2, or Lv.3)
        if (!row["Level"] || row["Level"].trim() === "") {
          errors.push("Level is required");
        } else {
          const levelValue = row["Level"].trim();
          const validLevels = ["Lv.1", "Lv.2", "Lv.3", "Lv 1", "Lv 2", "Lv 3", "Level 1", "Level 2", "Level 3", "1", "2", "3"];
          if (!validLevels.includes(levelValue) && !["Lv.1", "Lv.2", "Lv.3"].includes(levelValue)) {
            errors.push("Level must be one of: Lv.1, Lv.2, or Lv.3");
          }
        }

        // Validate Zone (must be Central or Regional)
        if (!row["Zone"] || row["Zone"].trim() === "") {
          errors.push("Zone is required");
        } else {
          const zoneValue = row["Zone"].trim();
          if (!["Central", "Regional"].includes(zoneValue)) {
            errors.push("Zone must be either 'Central' or 'Regional'");
          }
        }

        // Validate Positioning (must be Decision Maker or Influencer)
        if (!row["Positioning"] || row["Positioning"].trim() === "") {
          errors.push("Positioning is required");
        } else {
          const positioningValue = row["Positioning"].trim();
          if (!["Decision Maker", "Influencer"].includes(positioningValue)) {
            errors.push("Positioning must be either 'Decision Maker' or 'Influencer'");
          }
        }

        if (!row["Awign Champion"] || row["Awign Champion"].trim() === "") {
          errors.push("Awign Champion is required");
        } else {
          const awignChampionValue = row["Awign Champion"].trim().toUpperCase();
          if (!["YES", "NO", "Y", "N", "TRUE", "FALSE", "1", "0"].includes(awignChampionValue)) {
            errors.push("Awign Champion must be YES or NO");
          }
        }

        // Validate Zone and Region relationship
        if (row["Zone"] === "Regional" && (!row["Region"] || row["Region"].trim() === "")) {
          errors.push("Region is required when Zone is Regional");
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
      setLoadingContacts(true);
      setCsvPreviewOpen(false);

      const text = await csvFileToUpload.text();
      const csvData = parseCSV(text);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to upload contacts");
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

      // Filter out invalid rows
      const validRows = csvData.filter((row: any, index: number) => {
        const previewRow = csvPreviewRows[index];
        return previewRow?.isValid;
      });

      // Helper functions to normalize enum values
      const normalizeLevel = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        // Map common variations to exact enum values
        if (normalized === "Lv.1" || normalized === "Lv 1" || normalized === "Level 1" || normalized === "1") return "Lv.1";
        if (normalized === "Lv.2" || normalized === "Lv 2" || normalized === "Level 2" || normalized === "2") return "Lv.2";
        if (normalized === "Lv.3" || normalized === "Lv 3" || normalized === "Level 3" || normalized === "3") return "Lv.3";
        // If it matches exactly, return as is
        if (["Lv.1", "Lv.2", "Lv.3"].includes(normalized)) return normalized;
        return null;
      };

      const normalizeZone = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        if (normalized === "Central" || normalized === "Regional") return normalized;
        return null;
      };

      const normalizePositioning = (value: string | null | undefined): string | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.trim();
        if (normalized === "Decision Maker" || normalized === "Influencer") return normalized;
        return null;
      };

      const contactsToInsert = validRows.map((row: any) => {
        const normalizedLevel = normalizeLevel(row["Level"]);
        const normalizedZone = normalizeZone(row["Zone"]);
        const normalizedPositioning = normalizePositioning(row["Positioning"]);

        if (!normalizedLevel || !normalizedZone || !normalizedPositioning) {
          throw new Error(`Row has invalid enum values. Level: ${row["Level"]}, Zone: ${row["Zone"]}, Positioning: ${row["Positioning"]}`);
        }

        return {
          account_id: accountMap[row["Account Name"]],
          first_name: row["First Name"],
          last_name: row["Last Name"],
          email: row["Email"],
          phone_number: row["Phone Number"],
          department: row["Department"],
          kra: row["KRA"] || null,
          title: row["Title"],
          level: normalizedLevel,
          zone: normalizedZone,
          region: normalizedZone === "Regional" ? (row["Region"] || null) : null,
          reports_to: row["Reports To"] || null,
          positioning: normalizedPositioning,
          awign_champion: (() => {
            const value = (row["Awign Champion"] || "").trim().toUpperCase();
            return value === "YES" || value === "Y" || value === "TRUE" || value === "1";
          })(),
          created_by: user.id,
        };
      });

      // Upsert contacts in batches (update if phone number exists, insert if new)
      const batchSize = 50;
      let successCount = 0;
      let updateCount = 0;
      let insertCount = 0;
      let errorCount = 0;

      // Get all phone numbers to check which ones exist
      const phoneNumbers = contactsToInsert.map((c: any) => c.phone_number);
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("id, phone_number")
        .in("phone_number", phoneNumbers);

      const existingContactMap: Record<string, string> = {};
      existingContacts?.forEach((c: any) => {
        existingContactMap[c.phone_number] = c.id;
      });

      for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        
        // Separate into updates and inserts
        const toUpdate: any[] = [];
        const toInsert: any[] = [];

        batch.forEach((contact: any) => {
          const existingId = existingContactMap[contact.phone_number];
          if (existingId) {
            // Update existing
            toUpdate.push({ ...contact, id: existingId });
          } else {
            // Insert new
            toInsert.push(contact);
          }
        });

        // Update existing contacts
        for (const contact of toUpdate) {
          const { id, ...updateData } = contact;
          const { error } = await supabase
            .from("contacts")
            .update(updateData)
            .eq("id", id);
          
          if (error) {
            console.error("Error updating contact:", error);
            errorCount++;
          } else {
            updateCount++;
            successCount++;
          }
        }

        // Insert new contacts
        if (toInsert.length > 0) {
          const { error } = await supabase.from("contacts").insert(toInsert);
          
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
        description: `Successfully processed ${successCount} contacts (${insertCount} inserted, ${updateCount} updated). ${errorCount > 0 ? `${errorCount} failed.` : ""}`,
      });

      // Reset preview state
      setCsvPreviewRows([]);
      setCsvFileToUpload(null);

      // Refresh contacts list
      fetchContacts();
    } catch (error: any) {
      console.error("Error uploading contacts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload contacts. Please check the CSV format.",
        variant: "destructive",
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleCancelUpload = () => {
    setCsvPreviewOpen(false);
    setCsvPreviewRows([]);
    setCsvFileToUpload(null);
  };

  const handleExportContacts = async () => {
    try {
      setLoadingContacts(true);
      
      // Use filtered contacts if filters are active, otherwise fetch all
      let dataToExport: any[];
      
      if (hasActiveFilters) {
        // Export filtered contacts - need to fetch account names for filtered contacts
        const filteredContactIds = filteredContacts.map(c => c.id);
        if (filteredContactIds.length === 0) {
          toast({
            title: "No data",
            description: "No contacts found to export.",
            variant: "default",
          });
          return;
        }
        
        const { data, error } = await supabase
          .from("contacts")
          .select(`
            *,
            accounts:account_id (
              id,
              name
            )
          `)
          .in("id", filteredContactIds)
          .order("created_at", { ascending: false });

        if (error) throw error;
        dataToExport = data || [];
      } else {
        // Fetch all contacts with account names
        const { data, error } = await supabase
          .from("contacts")
          .select(`
            *,
            accounts:account_id (
              id,
              name
            )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;
        dataToExport = data || [];
      }

      if (!dataToExport || dataToExport.length === 0) {
        toast({
          title: "No data",
          description: "No contacts found to export.",
          variant: "default",
        });
        return;
      }

      // Prepare data for CSV with all fields
      const csvData = dataToExport.map((contact: any) => ({
        id: contact.id || "",
        account_id: contact.account_id || "",
        account_name: contact.accounts?.name || "",
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        phone_number: contact.phone_number || "",
        department: contact.department || "",
        kra: contact.kra || "",
        title: contact.title || "",
        level: contact.level || "",
        zone: contact.zone || "",
        region: contact.region || "",
        reports_to: contact.reports_to || "",
        positioning: contact.positioning || "",
        awign_champion: contact.awign_champion ? "YES" : "NO",
        created_at: formatTimestampForCSV(contact.created_at),
        updated_at: formatTimestampForCSV(contact.updated_at),
        created_by: contact.created_by || "",
      }));

      const csvContent = convertToCSV(csvData);
      const filename = hasActiveFilters 
        ? `filtered_contacts_export_${new Date().toISOString().split("T")[0]}.csv`
        : `contacts_export_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCSV(csvContent, filename);

      toast({
        title: "Success!",
        description: `Exported ${csvData.length} ${hasActiveFilters ? 'filtered ' : ''}contacts to CSV.`,
      });
    } catch (error: any) {
      console.error("Error exporting contacts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to export contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (viewMode === "view") {
      fetchContacts();
    }
  }, [viewMode]);

  const filteredContacts = contacts.filter((contact) => {
    // Search across all displayed fields
    const matchesSearch = !searchTerm || (() => {
      const searchLower = searchTerm.toLowerCase();
      const searchableFields = [
        contact.accountName || "",
        contact.first_name || "",
        contact.last_name || "",
        `${contact.first_name} ${contact.last_name}`,
        contact.email || "",
        contact.phone_number || "",
        contact.title || "",
        contact.level || "",
      ];
      return searchableFields.some(field => field.toLowerCase().includes(searchLower));
    })();
    
    const matchesAccount = filterAccount === "all" || contact.account_id === filterAccount;
    const matchesDepartment = filterDepartment === "all" || contact.department === filterDepartment;
    const matchesTitle = filterTitle === "all" || contact.title === filterTitle;
    const matchesLevel = filterLevel === "all" || contact.level === filterLevel;
    const matchesAwignChampion = filterAwignChampion === "all" || 
      (filterAwignChampion === "YES" && contact.awign_champion === true) ||
      (filterAwignChampion === "NO" && contact.awign_champion === false);

    return matchesSearch && matchesAccount && matchesDepartment && matchesTitle && matchesLevel && matchesAwignChampion;
  });

  // Check if any filters are active
  const hasActiveFilters = searchTerm || filterAccount !== "all" || filterDepartment !== "all" || filterTitle !== "all" || filterLevel !== "all" || filterAwignChampion !== "all";

  const handleViewDetails = (contact: any) => {
    setSelectedContact(contact);
    setEditContactData({
      accountId: contact.account_id || "",
      firstName: contact.first_name || "",
      lastName: contact.last_name || "",
      email: contact.email || "",
      phoneNumber: contact.phone_number || "",
      department: contact.department || "",
      kra: contact.kra || "",
      title: contact.title || "",
      level: contact.level || "",
      zone: contact.zone || "",
      region: contact.region || "",
      reportsTo: contact.reports_to || "",
      positioning: contact.positioning || "",
      awignChampion: contact.awign_champion ? "YES" : "NO",
    });
    setIsEditMode(false);
    setDetailsModalOpen(true);
    
    // Fetch contacts for the selected contact's account for Reports To dropdown
    if (contact.account_id) {
      fetchEditAccountContacts(contact.account_id);
    }
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete?.id) return;

    setDeletingContact(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactToDelete.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });

      // Refresh contacts list
      fetchContacts();
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    } finally {
      setDeletingContact(false);
    }
  };

  const fetchEditAccountContacts = async (accountId: string) => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("account_id", accountId)
        .order("first_name");

      if (error) throw error;
      setEditAccountContacts(data || []);
    } catch (error) {
      console.error("Error fetching account contacts:", error);
      setEditAccountContacts([]);
    }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;
    
    setUpdatingContact(true);
    try {
      const updateData: any = {
        account_id: editContactData.accountId || null,
        first_name: editContactData.firstName,
        last_name: editContactData.lastName,
        email: editContactData.email,
        phone_number: editContactData.phoneNumber,
        department: editContactData.department || null,
        kra: sanitizeValue(editContactData.kra),
        title: editContactData.title || null,
        level: editContactData.level || null,
        zone: editContactData.zone || null,
        region: editContactData.zone === "Regional" ? sanitizeValue(editContactData.region) : null,
        reports_to: sanitizeValue(editContactData.reportsTo),
        positioning: editContactData.positioning || null,
        awign_champion: editContactData.awignChampion === "YES",
      };

      const { error } = await supabase
        .from("contacts")
        .update(updateData)
        .eq("id", selectedContact.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Contact updated successfully.",
      });

      setIsEditMode(false);
      setDetailsModalOpen(false);
      fetchContacts();
    } catch (error: any) {
      console.error("Error updating contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingContact(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your business contacts and relationships.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportContacts}
            disabled={loadingContacts}
          >
            <Download className="mr-2 h-4 w-4" />
            {hasActiveFilters ? "Download Filtered Contacts" : "Export Contacts"}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadContactTemplate}
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
                  handleBulkUploadContacts(file);
                }
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              asChild
              disabled={loadingContacts}
            >
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </span>
            </Button>
          </label>
          <Button onClick={() => setFormDialogOpen(true)}>
            Add Contact
          </Button>
        </div>
      </div>

      {/* Add Contact Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => {
        setFormDialogOpen(open);
        if (!open) {
          // Reset form when dialog closes
          setFormData({
            accountId: "",
            firstName: "",
            lastName: "",
            email: "",
            phoneNumber: "",
            department: "",
            kra: "",
            title: "",
            level: "",
            zone: "",
            region: "",
            reportsTo: "",
            positioning: "",
            awignChampion: "",
          });
          setAccountSearch("");
          setReportsToSearch("");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1st Segment: General Information */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">General Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="john@domain.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                      placeholder="9876543210"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      placeholder="Doe"
                      required
                    />
                  </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Segment: Responsibility */}
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Responsibility</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">
                      Department <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => handleInputChange("department", e.target.value)}
                      placeholder="Finance"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Head of Procurement"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kra">KRA</Label>
                    <Input
                      id="kra"
                      value={formData.kra}
                      onChange={(e) => handleInputChange("kra", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">
                      Level <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.level}
                      onValueChange={(value) => handleInputChange("level", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lv.3">Lv.3</SelectItem>
                        <SelectItem value="Lv.2">Lv.2</SelectItem>
                        <SelectItem value="Lv.1">Lv.1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3rd Segment: Mapping */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zone">
                      Zone <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.zone}
                      onValueChange={(value) => handleInputChange("zone", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Central">Central</SelectItem>
                        <SelectItem value="Regional">Regional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportsTo">Reports To</Label>
                    <Select
                      value={formData.reportsTo || "N/A"}
                      onValueChange={(value) => handleInputChange("reportsTo", value === "N/A" ? "" : value)}
                      disabled={!formData.accountId || loadingAccountContacts}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!formData.accountId ? "Select account first" : "Select contact or N/A"} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Search contacts..."
                            value={reportsToSearch}
                            onChange={(e) => setReportsToSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                        </div>
                        <SelectItem value="N/A">N/A</SelectItem>
                        {accountContacts.length > 0 ? (
                          accountContacts
                            .filter((contact) =>
                              `${contact.first_name} ${contact.last_name}`
                                .toLowerCase()
                                .includes(reportsToSearch.toLowerCase())
                            )
                            .map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.first_name} {contact.last_name}
                              </SelectItem>
                            ))
                        ) : formData.accountId ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No contacts found for this account
                          </div>
                        ) : null}
                        {accountContacts.length > 0 && accountContacts.filter((contact) =>
                          `${contact.first_name} ${contact.last_name}`
                            .toLowerCase()
                            .includes(reportsToSearch.toLowerCase())
                        ).length === 0 && reportsToSearch && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No contacts found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.zone === "Regional" && (
                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Input
                        id="region"
                        value={formData.region}
                        onChange={(e) => handleInputChange("region", e.target.value)}
                        placeholder="North 2"
                      />
                    </div>
                  )}
                  </div>
                </CardContent>
              </Card>

              {/* 4th Segment: Supplement */}
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-orange-900">Supplement</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="positioning">
                      Positioning <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.positioning}
                      onValueChange={(value) => handleInputChange("positioning", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select positioning" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                        <SelectItem value="Influencer">Influencer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awignChampion">
                      Awign Champion <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.awignChampion}
                      onValueChange={(value) => handleInputChange("awignChampion", value)}
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
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      accountId: "",
                      firstName: "",
                      lastName: "",
                      email: "",
                      phoneNumber: "",
                      department: "",
                      kra: "",
                      title: "",
                      level: "",
                      zone: "",
                      region: "",
                      reportsTo: "",
                      positioning: "",
                      awignChampion: "",
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
                    "Save Contact"
                  )}
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* View Contacts Table */}
      {viewMode === "view" && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4">Filters</h3>
              <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Input
                  placeholder="Search all fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                    className={searchTerm ? "border-blue-500 bg-blue-50/50" : ""}
                />
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className={filterAccount !== "all" ? "border-blue-500 bg-blue-50/50" : ""}>
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
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                    <SelectTrigger className={filterDepartment !== "all" ? "border-blue-500 bg-blue-50/50" : ""}>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {[...new Set(contacts.map((c) => c.department).filter(Boolean))].sort().map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterTitle} onValueChange={setFilterTitle}>
                    <SelectTrigger className={filterTitle !== "all" ? "border-blue-500 bg-blue-50/50" : ""}>
                    <SelectValue placeholder="All Titles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Titles</SelectItem>
                    {[...new Set(contacts.map((c) => c.title).filter(Boolean))].sort().map((title) => (
                      <SelectItem key={title} value={title}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                    <SelectTrigger className={filterLevel !== "all" ? "border-blue-500 bg-blue-50/50" : ""}>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {[...new Set(contacts.map((c) => c.level).filter(Boolean))].sort().map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterAwignChampion} onValueChange={setFilterAwignChampion}>
                    <SelectTrigger className={filterAwignChampion !== "all" ? "border-blue-500 bg-blue-50/50" : ""}>
                    <SelectValue placeholder="All Awign Champions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Awign Champions</SelectItem>
                    <SelectItem value="YES">YES</SelectItem>
                    <SelectItem value="NO">NO</SelectItem>
                  </SelectContent>
                </Select>
                </div>
                <div className="flex justify-end">
                <Button
                    className="bg-black text-white hover:bg-black/90"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterAccount("all");
                    setFilterDepartment("all");
                    setFilterTitle("all");
                    setFilterLevel("all");
                    setFilterAwignChampion("all");
                  }}
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
                    <TableHead>Account</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Awign Champion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingContacts ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Loading contacts...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No contacts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell><HighlightedText text={contact.accountName || "N/A"} searchTerm={searchTerm} /></TableCell>
                        <TableCell className="font-medium">
                          <HighlightedText text={`${contact.first_name} ${contact.last_name}`} searchTerm={searchTerm} />
                        </TableCell>
                        <TableCell><HighlightedText text={contact.email} searchTerm={searchTerm} /></TableCell>
                        <TableCell><HighlightedText text={contact.phone_number} searchTerm={searchTerm} /></TableCell>
                        <TableCell><HighlightedText text={contact.title} searchTerm={searchTerm} /></TableCell>
                        <TableCell><HighlightedText text={contact.level} searchTerm={searchTerm} /></TableCell>
                        <TableCell>{contact.awign_champion ? "YES" : "NO"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(contact)}
                            >
                              View Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setContactToDelete(contact);
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

      {/* Contact Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={(open) => {
        setDetailsModalOpen(open);
        if (!open) {
          setIsEditMode(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedContact
                ? `${selectedContact.first_name} ${selectedContact.last_name}`
                : "Contact Details"}
            </DialogTitle>
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
                  setEditContactData({
                    accountId: selectedContact.account_id || "",
                    firstName: selectedContact.first_name || "",
                    lastName: selectedContact.last_name || "",
                    email: selectedContact.email || "",
                    phoneNumber: selectedContact.phone_number || "",
                    department: selectedContact.department || "",
                    kra: selectedContact.kra || "",
                    title: selectedContact.title || "",
                    level: selectedContact.level || "",
                    zone: selectedContact.zone || "",
                    region: selectedContact.region || "",
                    reportsTo: selectedContact.reports_to || "",
                    positioning: selectedContact.positioning || "",
                    awignChampion: selectedContact.awign_champion ? "YES" : "NO",
                  });
                }}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateContact} disabled={updatingContact}>
                  {updatingContact ? (
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
          {selectedContact && editContactData && (
            <div className="space-y-6">
              {/* 1st Segment: General Information */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">General Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Account Name:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.accountId}
                          onValueChange={(value) => {
                            setEditContactData({ ...editContactData, accountId: value, reportsTo: "" });
                            fetchEditAccountContacts(value);
                          }}
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
                        <p className="mt-1">{selectedContact.accountName || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Email:</Label>
                      {isEditMode ? (
                        <Input
                          type="email"
                          value={editContactData.email}
                          onChange={(e) => setEditContactData({ ...editContactData, email: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.email || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">First Name:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.firstName}
                          onChange={(e) => setEditContactData({ ...editContactData, firstName: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.first_name || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Phone Number:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.phoneNumber}
                          onChange={(e) => setEditContactData({ ...editContactData, phoneNumber: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.phone_number || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Last Name:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.lastName}
                          onChange={(e) => setEditContactData({ ...editContactData, lastName: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.last_name || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Segment: Responsibility */}
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Responsibility</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Department:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.department}
                          onChange={(e) => setEditContactData({ ...editContactData, department: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.department || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Title:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.title}
                          onChange={(e) => setEditContactData({ ...editContactData, title: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.title || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">KRA:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.kra}
                          onChange={(e) => setEditContactData({ ...editContactData, kra: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.kra || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Level:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.level}
                          onValueChange={(value) => setEditContactData({ ...editContactData, level: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lv.3">Lv.3</SelectItem>
                            <SelectItem value="Lv.2">Lv.2</SelectItem>
                            <SelectItem value="Lv.1">Lv.1</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.level || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3rd Segment: Mapping */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Zone:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.zone}
                          onValueChange={(value) => setEditContactData({ ...editContactData, zone: value, region: value === "Regional" ? editContactData.region : "" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Central">Central</SelectItem>
                            <SelectItem value="Regional">Regional</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.zone || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Reports To:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.reportsTo || "N/A"}
                          onValueChange={(value) => setEditContactData({ ...editContactData, reportsTo: value === "N/A" ? "" : value })}
                          disabled={!editContactData.accountId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={!editContactData.accountId ? "Select account first" : "Select contact or N/A"} />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                placeholder="Search contacts..."
                                value={editReportsToSearch}
                                onChange={(e) => setEditReportsToSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="h-8"
                              />
                            </div>
                            <SelectItem value="N/A">N/A</SelectItem>
                            {editAccountContacts.length > 0 ? (
                              editAccountContacts
                                .filter((contact) => contact.id !== selectedContact.id) // Exclude current contact
                                .filter((contact) =>
                                  `${contact.first_name} ${contact.last_name}`
                                    .toLowerCase()
                                    .includes(editReportsToSearch.toLowerCase())
                                )
                                .map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    {contact.first_name} {contact.last_name}
                                  </SelectItem>
                                ))
                            ) : editContactData.accountId ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No other contacts found for this account
                              </div>
                            ) : null}
                            {editAccountContacts.length > 0 && editAccountContacts
                              .filter((contact) => contact.id !== selectedContact.id)
                              .filter((contact) =>
                                `${contact.first_name} ${contact.last_name}`
                                  .toLowerCase()
                                  .includes(editReportsToSearch.toLowerCase())
                              ).length === 0 && editReportsToSearch && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No contacts found
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">
                          {selectedContact.reports_to 
                            ? editAccountContacts.find(c => c.id === selectedContact.reports_to) 
                              ? `${editAccountContacts.find(c => c.id === selectedContact.reports_to)?.first_name} ${editAccountContacts.find(c => c.id === selectedContact.reports_to)?.last_name}`
                              : "N/A"
                            : "N/A"}
                        </p>
                      )}
                    </div>
                    {((isEditMode && editContactData.zone === "Regional") || (!isEditMode && selectedContact.zone === "Regional")) && (
                      <div className="space-y-2">
                        <Label className="font-medium text-muted-foreground">Region:</Label>
                        {isEditMode ? (
                          <Input
                            value={editContactData.region}
                            onChange={(e) => setEditContactData({ ...editContactData, region: e.target.value })}
                            placeholder="North 2"
                          />
                        ) : (
                          <p className="mt-1">{selectedContact.region || "N/A"}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 4th Segment: Supplement */}
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-orange-900">Supplement</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Positioning:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.positioning}
                          onValueChange={(value) => setEditContactData({ ...editContactData, positioning: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select positioning" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                            <SelectItem value="Influencer">Influencer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.positioning || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Awign Champion:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.awignChampion}
                          onValueChange={(value) => setEditContactData({ ...editContactData, awignChampion: value })}
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
                        <p className="mt-1">{selectedContact.awign_champion ? "YES" : "NO"}</p>
                      )}
                    </div>
                  </div>
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
        loading={loadingContacts}
        title="Preview Contacts CSV Upload"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the contact "{contactToDelete?.first_name} {contactToDelete?.last_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingContact}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={deletingContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingContact ? (
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
