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
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  solutionProposalSlides: string;
  ganttChartUrl: string;
  expectedContractSignDate: string;
  contractSignDate: string;
  signedContractLink: string;
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

const prjDurationOptions = ["1", "6", "12"];
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
  return Object.keys(lobUseCaseMapping[lob]);
};

const getSubUseCasesForUseCase = (lob: string, useCase: string): string[] => {
  if (!lob || !useCase || !lobUseCaseMapping[lob] || !lobUseCaseMapping[lob][useCase]) return [];
  return lobUseCaseMapping[lob][useCase];
};

export default function Pipeline() {
  const [loading, setLoading] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  const [updatingDeal, setUpdatingDeal] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [kams, setKams] = useState<{ id: string; full_name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string; account_id: string }[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  
  // Filters for view mode
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLob, setFilterLob] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

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
    solutionProposalSlides: "",
    ganttChartUrl: "",
    expectedContractSignDate: "",
    contractSignDate: "",
    signedContractLink: "",
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

  // Fetch deals from database
  const fetchDeals = async () => {
    setLoadingDeals(true);
    try {
      const { data, error } = await supabase
        .from("pipeline_deals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

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
        useCase: deal.use_case,
        expectedRevenue: deal.expected_revenue,
      }));

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
  }, [formData.lob]);

  // Reset Sub Use Case when Use Case changes
  useEffect(() => {
    if (formData.lob && formData.useCase) {
      const validSubUseCases = getSubUseCasesForUseCase(formData.lob, formData.useCase);
      // Only reset if current subUseCase is not valid for the new useCase
      if (formData.subUseCase && !validSubUseCases.includes(formData.subUseCase)) {
        setFormData((prev) => ({
          ...prev,
          subUseCase: "",
        }));
      }
    }
  }, [formData.useCase]);

  // Auto-generate Sales Module Name
  useEffect(() => {
    if (formData.accountId && formData.lob && formData.useCase) {
      const account = accounts.find((a) => a.id === formData.accountId);
      const moduleName = `${account?.name || ""} - ${formData.lob} - ${formData.useCase}`;
      setFormData((prev) => ({
        ...prev,
        salesModuleName: moduleName,
      }));
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
        gm_threshold: formData.gmThreshold ? parseFloat(formData.gmThreshold) : null,
        prj_frequency: formData.prjFrequency,
        status: formData.status,
        prj_start_date: formData.prjStartDate || null,
        probability: parseInt(formData.probability) || 10,
        solution_proposal_slides: formData.solutionProposalSlides || null,
        gantt_chart_url: formData.ganttChartUrl || null,
        expected_contract_sign_date: formData.expectedContractSignDate || null,
        contract_sign_date: formData.contractSignDate || null,
        signed_contract_link: formData.signedContractLink || null,
        dropped_reason: formData.droppedReason || null,
        dropped_reason_others: formData.droppedReasonOthers || null,
        created_by: user.id,
      };

      const { error: insertError } = await supabase
        .from("pipeline_deals")
        .insert([dealData]);

      if (insertError) throw insertError;

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
        solutionProposalSlides: "",
        ganttChartUrl: "",
        expectedContractSignDate: "",
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
      solutionProposalSlides: deal.solution_proposal_slides || "",
      ganttChartUrl: deal.gantt_chart_url || "",
      expectedContractSignDate: deal.expected_contract_sign_date || "",
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
        gm_threshold: formData.gmThreshold ? parseFloat(formData.gmThreshold) : null,
        prj_frequency: formData.prjFrequency,
        status: formData.status,
        prj_start_date: formData.prjStartDate || null,
        probability: parseInt(formData.probability) || 10,
        solution_proposal_slides: formData.solutionProposalSlides || null,
        gantt_chart_url: formData.ganttChartUrl || null,
        expected_contract_sign_date: formData.expectedContractSignDate || null,
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

  const showProposalBlock = formData.status === "Solution Proposal Made" || formData.status === "SOW Handshake Done" || formData.status === "Final Proposal Done";
  const showClosedWonBlock = formData.status === "Closed Won";
  const showDroppedBlock = formData.status === "Dropped";

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch =
      deal.account?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.kam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.useCase?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLob = filterLob === "all" || deal.lob === filterLob;
    const matchesStatus = filterStatus === "all" || deal.status === filterStatus;

    return matchesSearch && matchesLob && matchesStatus;
  });

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
        <Button onClick={() => setFormDialogOpen(true)}>
          Add Deal
        </Button>
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
            solutionProposalSlides: "",
            ganttChartUrl: "",
            expectedContractSignDate: "",
            contractSignDate: "",
            signedContractLink: "",
            droppedReason: "",
            droppedReasonOthers: "",
          });
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
                        {kams.length > 0 ? (
                          kams.map((kam) => (
                            <SelectItem key={kam.id} value={kam.id}>
                              {kam.full_name || "Unknown"}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No KAMs available
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
                        {accounts.length > 0 ? (
                          accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No accounts available
                          </div>
                        )}
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
                        {contacts.length > 0 ? (
                          contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {formData.accountId ? "No contacts available" : "Select account first"}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
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
                        {contacts.length > 0 ? (
                          contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {formData.accountId ? "No contacts available" : "Select account first"}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
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
                        {contacts.length > 0 ? (
                          contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {formData.accountId ? "No contacts available" : "Select account first"}
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
                    <Label htmlFor="useCase">
                      Use Case <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.useCase}
                      onValueChange={(value) => handleInputChange("useCase", value)}
                      required
                      disabled={!formData.lob}
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subUseCase">
                      Sub Use Case <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.subUseCase}
                      onValueChange={(value) => handleInputChange("subUseCase", value)}
                      required
                      disabled={!formData.lob || !formData.useCase}
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label htmlFor="gmThreshold">GM Threshold</Label>
                    <Input
                      id="gmThreshold"
                      type="number"
                      value={formData.gmThreshold}
                      onChange={(e) => handleInputChange("gmThreshold", e.target.value)}
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
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                </div>
              </CardContent>
            </Card>

            {/* Status Based Details */}
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
                        <div className="space-y-2">
                          <Label htmlFor="expectedContractSignDate">
                            Expected Contract Sign Date <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="expectedContractSignDate"
                            type="date"
                            value={formData.expectedContractSignDate}
                            onChange={(e) => handleInputChange("expectedContractSignDate", e.target.value)}
                            required={showProposalBlock}
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
                          <Label htmlFor="contractSignDate">
                            Contract Sign Date <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="contractSignDate"
                            type="date"
                            value={formData.contractSignDate}
                            onChange={(e) => handleInputChange("contractSignDate", e.target.value)}
                            required={showClosedWonBlock}
                          />
                        </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                placeholder="Search by Account / KAM / Use Case"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Closed Won">Closed Won</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
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
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Loading deals...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No deals found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeals.map((deal) => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium">{deal.account || "N/A"}</TableCell>
                        <TableCell>{deal.kam || "N/A"}</TableCell>
                        <TableCell>{deal.lob || "N/A"}</TableCell>
                        <TableCell>
                          {deal.expectedRevenue
                            ? `₹${parseFloat(deal.expectedRevenue).toLocaleString("en-IN")}`
                            : "N/A"}
                        </TableCell>
                        <TableCell>{deal.status || "N/A"}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditDeal(deal)}
                          >
                            Edit
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
    </div>
  );
}
