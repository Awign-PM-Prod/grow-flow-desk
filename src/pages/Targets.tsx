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
import { Plus, Loader2 } from "lucide-react";
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
}

interface MonthlyTarget {
  id: string;
  month: number;
  year: number;
  financial_year: string;
  target: number;
  created_by: string;
  created_at: string;
}

export default function Targets() {
  const { hasRole, loading, userRoles } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<MonthlyTargetFormData>({
    month: "",
    year: "",
    target: "",
    financialYear: "",
  });
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

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

      setMonthlyTargets(data || []);
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

  useEffect(() => {
    if (!loading && userRoles.length > 0) {
      // Only allow manager, leadership, and superadmin roles
      // KAM users should not have access
      const hasAccess = hasRole("manager") || hasRole("leadership") || hasRole("superadmin");
      
      if (!hasAccess) {
        navigate("/dashboard");
      } else {
        // Fetch targets when user has access
        fetchMonthlyTargets();
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
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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
      // Columns: month (integer), year (integer), financial_year (text), target (numeric), created_by (uuid), created_at (timestamp)
      const targetData = {
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        financial_year: formData.financialYear,
        target: targetValue,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      // Insert into monthly_targets table
      const { error: insertError } = await supabase
        .from("monthly_targets")
        .insert([targetData]);
      
      if (insertError) {
        // If table doesn't exist, show a helpful message
        if (insertError.code === "42P01" || insertError.message.includes("does not exist")) {
          toast({
            title: "Table Not Found",
            description: "The monthly_targets table needs to be created first. Please create the table in your database.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
        throw insertError;
      }

      toast({
        title: "Success!",
        description: `Target for ${getMonthName(parseInt(formData.month))} ${formData.year} (FY: ${formData.financialYear}) saved successfully.`,
      });

      // Reset form
      setFormData({
        month: "",
        year: "",
        target: "",
        financialYear: "",
      });

      // Close dialog
      setFormDialogOpen(false);
      
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
            // Reset form when dialog closes
            setFormData({
              month: "",
              year: "",
              target: "",
              financialYear: "",
            });
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
                <DialogTitle>Add Monthly Target</DialogTitle>
                <DialogDescription>
                  Add a target for a specific month. The financial year will be calculated automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
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
                <Button type="submit" disabled={submitting || !formData.month || !formData.year || !formData.target}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Target"
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
                  <TableHead className="text-right">Target Value</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyTargets.map((target) => (
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
                    <TableCell className="text-right font-semibold">
                      {target.target.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(target.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

