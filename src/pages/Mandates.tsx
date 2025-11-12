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
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewMode = "form" | "view";

interface MandateFormData {
  // Project Info
  projectCode: string;
  projectName: string;
  accountId: string;
  kamId: string;
  lob: string;

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
  const [filterLob, setFilterLob] = useState("all");
  const [filterMandateHealth, setFilterMandateHealth] = useState("all");
  const [filterUpsellStatus, setFilterUpsellStatus] = useState("all");
  const [mandates, setMandates] = useState<any[]>([]);
  const [loadingMandates, setLoadingMandates] = useState(false);
  const [availableLobs, setAvailableLobs] = useState<string[]>([]);
  const [selectedMandate, setSelectedMandate] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editMandateData, setEditMandateData] = useState<any>(null);
  const [updatingMandate, setUpdatingMandate] = useState(false);
  const [isMandateCheckerEditMode, setIsMandateCheckerEditMode] = useState(false);
  const [updatingMandateChecker, setUpdatingMandateChecker] = useState(false);

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

  // Auto-calculate Retention Type (simplified logic - can be enhanced) for form
  useEffect(() => {
    if (formData.awignSharePercent && formData.mandateHealth) {
      let retentionType = "";
      if (formData.awignSharePercent === "70% & Above" && formData.mandateHealth === "Exceeds Expectations") {
        retentionType = "Star";
      } else if (formData.mandateHealth === "Meets Expectations") {
        retentionType = "Standard";
      } else {
        retentionType = "Needs Attention";
      }
      setFormData((prev) => ({
        ...prev,
        retentionType,
      }));
    }
  }, [formData.awignSharePercent, formData.mandateHealth]);

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

  // Auto-calculate Retention Type for edit mode
  useEffect(() => {
    if (editMandateData && editMandateData.awignSharePercent && editMandateData.mandateHealth) {
      let retentionType = "";
      if (editMandateData.awignSharePercent === "70% & Above" && editMandateData.mandateHealth === "Exceeds Expectations") {
        retentionType = "Star";
      } else if (editMandateData.mandateHealth === "Meets Expectations") {
        retentionType = "Standard";
      } else {
        retentionType = "Needs Attention";
      }
      setEditMandateData((prev: any) => ({
        ...prev,
        retentionType,
      }));
    }
  }, [editMandateData?.awignSharePercent, editMandateData?.mandateHealth]);

  const handleInputChange = (field: keyof MandateFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
        account_id: formData.accountId || null,
        kam_id: formData.kamId || null,
        lob: formData.lob,
        
        // Handover Info
        new_sales_owner: formData.newSalesOwner || null,
        handover_monthly_volume: formData.handoverMonthlyVolume ? parseFloat(formData.handoverMonthlyVolume) : null,
        handover_commercial_per_head: formData.handoverCommercialPerHead ? parseFloat(formData.handoverCommercialPerHead) : null,
        handover_mcv: formData.handoverMcv ? parseFloat(formData.handoverMcv) : null,
        prj_duration_months: formData.prjDurationMonths ? parseInt(formData.prjDurationMonths) : null,
        handover_acv: formData.handoverAcv ? parseFloat(formData.handoverAcv) : null,
        handover_prj_type: formData.handoverPrjType || null,
        
        // Revenue Info
        revenue_monthly_volume: formData.revenueMonthlyVolume ? parseFloat(formData.revenueMonthlyVolume) : null,
        revenue_commercial_per_head: formData.revenueCommercialPerHead ? parseFloat(formData.revenueCommercialPerHead) : null,
        revenue_mcv: formData.revenueMcv ? parseFloat(formData.revenueMcv) : null,
        revenue_acv: formData.revenueAcv ? parseFloat(formData.revenueAcv) : null,
        revenue_prj_type: formData.revenuePrjType || null,
        
        // Mandate Checker
        mandate_health: formData.mandateHealth || null,
        upsell_constraint: formData.upsellConstraint === "YES",
        upsell_constraint_type: formData.upsellConstraintType && formData.upsellConstraintType !== "-" ? formData.upsellConstraintType : null,
        upsell_constraint_sub: formData.upsellConstraintSub || null,
        upsell_constraint_sub2: formData.upsellConstraintSub2 || null,
        client_budget_trend: formData.clientBudgetTrend || null,
        awign_share_percent: formData.awignSharePercent || null,
        retention_type: formData.retentionType || null,
        
        // Upsell Action Status
        upsell_action_status: formData.upsellActionStatus || null,
        
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
      }));

      setMandates(transformedMandates);

      // Extract unique LoB values for filter
      const uniqueLobs = [...new Set((data || []).map((m: any) => m.lob).filter(Boolean))];
      setAvailableLobs(uniqueLobs.sort());
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
    setFilterLob("all");
    setFilterMandateHealth("all");
    setFilterUpsellStatus("all");
  };

  const handleViewDetails = (mandate: any) => {
    setSelectedMandate(mandate);
    setEditMandateData({
      projectCode: mandate.project_code || "",
      projectName: mandate.project_name || "",
      accountId: mandate.account_id || "",
      kamId: mandate.kam_id || "",
      lob: mandate.lob || "",
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

  const handleUpdateMandate = async () => {
    if (!selectedMandate) return;
    
    setUpdatingMandate(true);
    try {
      const updateData: any = {
        project_code: editMandateData.projectCode || null,
        project_name: editMandateData.projectName || null,
        account_id: editMandateData.accountId || null,
        kam_id: editMandateData.kamId || null,
        lob: editMandateData.lob || null,
        new_sales_owner: editMandateData.newSalesOwner || null,
        handover_monthly_volume: editMandateData.handoverMonthlyVolume ? parseFloat(editMandateData.handoverMonthlyVolume) : null,
        handover_commercial_per_head: editMandateData.handoverCommercialPerHead ? parseFloat(editMandateData.handoverCommercialPerHead) : null,
        handover_mcv: editMandateData.handoverMcv ? parseFloat(editMandateData.handoverMcv) : null,
        prj_duration_months: editMandateData.prjDurationMonths ? parseInt(editMandateData.prjDurationMonths) : null,
        handover_acv: editMandateData.handoverAcv ? parseFloat(editMandateData.handoverAcv) : null,
        handover_prj_type: editMandateData.handoverPrjType || null,
        revenue_monthly_volume: editMandateData.revenueMonthlyVolume ? parseFloat(editMandateData.revenueMonthlyVolume) : null,
        revenue_commercial_per_head: editMandateData.revenueCommercialPerHead ? parseFloat(editMandateData.revenueCommercialPerHead) : null,
        revenue_mcv: editMandateData.revenueMcv ? parseFloat(editMandateData.revenueMcv) : null,
        revenue_acv: editMandateData.revenueAcv ? parseFloat(editMandateData.revenueAcv) : null,
        revenue_prj_type: editMandateData.revenuePrjType || null,
        mandate_health: editMandateData.mandateHealth || null,
        upsell_constraint: editMandateData.upsellConstraint === "YES",
        upsell_constraint_type: editMandateData.upsellConstraintType && editMandateData.upsellConstraintType !== "-" ? editMandateData.upsellConstraintType : null,
        upsell_constraint_sub: editMandateData.upsellConstraintSub || null,
        upsell_constraint_sub2: editMandateData.upsellConstraintSub2 || null,
        client_budget_trend: editMandateData.clientBudgetTrend || null,
        awign_share_percent: editMandateData.awignSharePercent || null,
        retention_type: editMandateData.retentionType || null,
        upsell_action_status: editMandateData.upsellActionStatus || null,
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
        mandate_health: editMandateData.mandateHealth || null,
        upsell_constraint: editMandateData.upsellConstraint === "YES",
        upsell_constraint_type: editMandateData.upsellConstraintType && editMandateData.upsellConstraintType !== "-" ? editMandateData.upsellConstraintType : null,
        upsell_constraint_sub: editMandateData.upsellConstraintSub || null,
        upsell_constraint_sub2: editMandateData.upsellConstraintSub2 || null,
        client_budget_trend: editMandateData.clientBudgetTrend || null,
        awign_share_percent: editMandateData.awignSharePercent || null,
        retention_type: editMandateData.retentionType || null,
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
    const matchesSearch =
      mandate.projectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mandate.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mandate.account.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mandate.kam.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLob = filterLob === "all" || mandate.lob === filterLob;
    const matchesHealth = filterMandateHealth === "all" || mandate.mandateHealth === filterMandateHealth;
    const matchesStatus = filterUpsellStatus === "all" || mandate.upsellStatus === filterUpsellStatus;

    return matchesSearch && matchesLob && matchesHealth && matchesStatus;
  });

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
        <Button onClick={() => setFormDialogOpen(true)}>
          Add Mandate
        </Button>
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
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Mandate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1st Section: Project Info */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">Project Info</h3>
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
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Section: Handover Info */}
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Handover Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="newSalesOwner">New Sales Owner</Label>
                      <Input
                        id="newSalesOwner"
                        value={formData.newSalesOwner}
                        onChange={(e) => handleInputChange("newSalesOwner", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
                      </div>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
                      </div>
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
                    <Label htmlFor="upsellConstraintType">
                      Upsell Constraint Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.upsellConstraintType}
                      onValueChange={(value) => handleInputChange("upsellConstraintType", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-">-</SelectItem>
                        <SelectItem value="Internal">Internal</SelectItem>
                        <SelectItem value="External">External</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upsellConstraintSub">
                      Upsell Constraint Type - Sub <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.upsellConstraintSub}
                      onValueChange={(value) => handleInputChange("upsellConstraintSub", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Profitability">Profitability</SelectItem>
                        <SelectItem value="Delivery">Delivery</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upsellConstraintSub2">
                      Upsell Constraint Type - Sub 2 <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.upsellConstraintSub2}
                      onValueChange={(value) => handleInputChange("upsellConstraintSub2", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GM too Low">GM too Low</SelectItem>
                        <SelectItem value="CoC (Cost of Capital too high)">
                          CoC (Cost of Capital too high)
                        </SelectItem>
                        <SelectItem value="Schedule too tight">Schedule too tight</SelectItem>
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
                      <Label htmlFor="retentionType">Retention Type</Label>
                      <Input
                        id="retentionType"
                        value={formData.retentionType}
                        placeholder="Auto"
                        readOnly
                        className="bg-muted"
                      />
                    </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Input
                  placeholder="Search by Project / Account / KAM"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
                <Select value={filterLob} onValueChange={setFilterLob}>
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="All Upsell Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Upsell Status</SelectItem>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                    <SelectItem value="Done">Done</SelectItem>
                  </SelectContent>
                </Select>
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
                      <TableHead>Project Code</TableHead>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>KAM</TableHead>
                      <TableHead>LoB</TableHead>
                      <TableHead>ACV</TableHead>
                      <TableHead>MCV</TableHead>
                      <TableHead>Mandate Health</TableHead>
                      <TableHead>Upsell Status</TableHead>
                      <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                    {loadingMandates ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground">Loading mandates...</span>
                    </div>
                  </TableCell>
                      </TableRow>
                    ) : filteredMandates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No mandates found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMandates.map((mandate) => (
                <TableRow key={mandate.id}>
                          <TableCell className="font-medium">{mandate.projectCode}</TableCell>
                          <TableCell>{mandate.projectName}</TableCell>
                          <TableCell>{mandate.account}</TableCell>
                          <TableCell>{mandate.kam}</TableCell>
                          <TableCell>{mandate.lob}</TableCell>
                          <TableCell>{mandate.acv}</TableCell>
                          <TableCell>{mandate.mcv}</TableCell>
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
                              {mandate.mandateHealth}
                    </Badge>
                  </TableCell>
                          <TableCell>
                            <Badge variant="outline">{mandate.upsellStatus}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewDetails(mandate)}
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
            {!isEditMode && !isMandateCheckerEditMode ? (
              <>
                <Button variant="outline" onClick={() => setIsEditMode(true)}>
                  Edit
                </Button>
                <Button variant="outline" onClick={() => {
                  // Ensure editMandateData has current values for Mandate Checker fields
                  setEditMandateData((prev: any) => ({
                    ...prev,
                    mandateHealth: selectedMandate.mandate_health || "",
                    upsellConstraint: selectedMandate.upsell_constraint ? "YES" : "NO",
                    upsellConstraintType: selectedMandate.upsell_constraint_type || "",
                    upsellConstraintSub: selectedMandate.upsell_constraint_sub || "",
                    upsellConstraintSub2: selectedMandate.upsell_constraint_sub2 || "",
                    clientBudgetTrend: selectedMandate.client_budget_trend || "",
                    awignSharePercent: selectedMandate.awign_share_percent || "",
                    retentionType: selectedMandate.retention_type || "",
                  }));
                  setIsMandateCheckerEditMode(true);
                  // Scroll to Mandate Checker section after a brief delay to allow state update
                  setTimeout(() => {
                    const mandateCheckerCard = document.getElementById('mandate-checker-section');
                    if (mandateCheckerCard) {
                      mandateCheckerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}>
                  Update
                </Button>
              </>
            ) : isEditMode ? (
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
            ) : null}
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
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                              </SelectItem>
                            ))}
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
                            {kams.map((kam) => (
                              <SelectItem key={kam.id} value={kam.id}>
                                {kam.full_name || "Unknown"}
                              </SelectItem>
                            ))}
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
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Section: Handover Info */}
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
                          onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellConstraint: value, upsellConstraintType: value === "NO" ? "" : editMandateData.upsellConstraintType, upsellConstraintSub: value === "NO" ? "" : editMandateData.upsellConstraintSub, upsellConstraintSub2: value === "NO" ? "" : editMandateData.upsellConstraintSub2 })}
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
                            onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellConstraintType: value, upsellConstraintSub: value === "-" ? "" : editMandateData.upsellConstraintSub, upsellConstraintSub2: value === "-" ? "" : editMandateData.upsellConstraintSub2 })}
                            disabled={editMandateData.upsellConstraint !== "YES"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-">-</SelectItem>
                              <SelectItem value="Internal">Internal</SelectItem>
                              <SelectItem value="External">External</SelectItem>
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
                            onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellConstraintSub: value })}
                            disabled={editMandateData.upsellConstraint !== "YES"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Profitability">Profitability</SelectItem>
                              <SelectItem value="Delivery">Delivery</SelectItem>
                              <SelectItem value="Others">Others</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="mt-1">{selectedMandate.upsell_constraint_sub || "N/A"}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-muted-foreground">Upsell Constraint Type - Sub 2:</Label>
                        {(isEditMode || isMandateCheckerEditMode) ? (
                          <Select
                            value={editMandateData.upsellConstraintSub2}
                            onValueChange={(value) => setEditMandateData({ ...editMandateData, upsellConstraintSub2: value })}
                            disabled={editMandateData.upsellConstraint !== "YES" || !editMandateData.upsellConstraintSub}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GM too Low">GM too Low</SelectItem>
                              <SelectItem value="CoC (Cost of Capital too high)">
                                CoC (Cost of Capital too high)
                              </SelectItem>
                              <SelectItem value="Schedule too tight">Schedule too tight</SelectItem>
                            </SelectContent>
                          </Select>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
