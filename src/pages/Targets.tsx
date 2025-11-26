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

interface MonthlyTargetFormData {
  month: string;
  year: string;
  target: string;
  financialYear: string;
  targetType: string;
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
  accountName?: string | null;
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
    accountId: "",
    mandateId: "",
  });
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loadingMandates, setLoadingMandates] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [mandateSearch, setMandateSearch] = useState("");

  const fetchMonthlyTargets = async () => {
    setLoadingTargets(true);
    try {
      const { data, error } = await supabase
        .from("monthly_targets")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) {
        // If table doesn't exist, show empty array instead of error
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          console.warn("Monthly targets table does not exist yet.");
          setMonthlyTargets([]);
          setLoadingTargets(false);
          return;
        }
        throw error;
      }

      // Fetch account and mandate names for display
      const accountIds = [...new Set((data || []).map((t: any) => t.account_id).filter(Boolean))];
      const mandateIds = [...new Set((data || []).map((t: any) => t.mandate_id).filter(Boolean))];

      const accountMap: Record<string, string> = {};
      const mandateMap: Record<string, { project_code: string; project_name: string }> = {};

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

      // Add account and mandate names to targets
      const targetsWithNames = (data || []).map((target: any) => ({
        ...target,
        accountName: target.account_id ? accountMap[target.account_id] : null,
        mandateInfo: target.mandate_id ? mandateMap[target.mandate_id] : null,
      }));

      setMonthlyTargets(targetsWithNames);
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
    } finally {
      setLoadingTargets(false);
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
        // Fetch targets, accounts, and mandates when user has access
        fetchMonthlyTargets();
        fetchAccounts();
        fetchMandates();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userRoles.length, navigate]);

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

  const handleInputChange = (field: keyof MonthlyTargetFormData, value: string) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };
      
      // Reset accountId and mandateId when targetType changes
      if (field === "targetType") {
        updated.accountId = "";
        updated.mandateId = "";
      }
      
      return updated;
    });
  };

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
      if (formData.targetType === "new_cross_sell" && !formData.accountId) {
        toast({
          title: "Validation Error",
          description: "Please select an account for new cross sell target.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
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

      // Prepare data for insertion
      // Expected table structure: monthly_targets
      // Columns: month (integer), year (integer), financial_year (text), target (numeric), target_type (text), account_id (uuid), mandate_id (uuid), created_by (uuid), created_at (timestamp)
      const targetData: any = {
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        financial_year: formData.financialYear,
        target: targetValue,
        target_type: formData.targetType,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      // Set account_id or mandate_id based on target type
      if (formData.targetType === "new_cross_sell") {
        targetData.account_id = formData.accountId;
        targetData.mandate_id = null;
      } else if (formData.targetType === "existing") {
        targetData.mandate_id = formData.mandateId;
        targetData.account_id = null;
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
        accountId: "",
        mandateId: "",
      });

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
              accountId: "",
              mandateId: "",
            });
            setEditingTarget(null);
            setAccountSearch("");
            setMandateSearch("");
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
                  <div className="grid gap-2">
                    <Label htmlFor="accountId">Account *</Label>
                    <Select
                      value={formData.accountId}
                      onValueChange={(value) => handleInputChange("accountId", value)}
                      required
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
                            {loadingAccounts ? "Loading accounts..." : "No accounts available"}
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
                <Button type="submit" disabled={submitting || !formData.month || !formData.year || !formData.target || !formData.targetType || (formData.targetType === "new_cross_sell" && !formData.accountId) || (formData.targetType === "existing" && !formData.mandateId)}>
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

      {/* Monthly Targets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Targets</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTargets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : monthlyTargets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No targets set for now.
              </p>
              <p className="text-sm text-muted-foreground">
                Use the "Add Monthly Target" button above to add targets for specific months.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Financial Year</TableHead>
                  <TableHead>Target Type</TableHead>
                  <TableHead>Account / Mandate</TableHead>
                  <TableHead className="text-right">Target Value</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyTargets.map((target) => {
                  const targetTypeLabel = target.target_type === "new_cross_sell" 
                    ? "New cross sell target" 
                    : target.target_type === "existing" 
                    ? "Existing" 
                    : "N/A";
                  const accountOrMandate = target.target_type === "new_cross_sell" 
                    ? (target.accountName || "N/A")
                    : target.target_type === "existing" && target.mandateInfo
                    ? `${target.mandateInfo.project_code} - ${target.mandateInfo.project_name}`
                    : "N/A";
                  
                  return (
                    <TableRow key={target.id}>
                      <TableCell className="font-medium">
                        {getMonthName(target.month)}
                      </TableCell>
                      <TableCell>{target.year}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
                          {target.financial_year}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-secondary/10 px-2 py-1 text-sm font-medium">
                          {targetTypeLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {accountOrMandate}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                          {target.target.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(target.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingTarget(target);
                              setFormData({
                                month: target.month.toString(),
                                year: target.year.toString(),
                                target: target.target.toString(),
                                financialYear: target.financial_year,
                                targetType: target.target_type || "",
                                accountId: target.account_id || "",
                                mandateId: target.mandate_id || "",
                              });
                              setFormDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

