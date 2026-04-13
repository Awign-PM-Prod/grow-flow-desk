import { CSVPreviewDialog } from "@/components/CSVPreviewDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV, parseCSV } from "@/lib/csv-export";
import { cn, formatNumber } from "@/lib/utils";
import { Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { TargetsOutletContext } from "./TargetsLayout";
import {
  formatFYLabel,
  getFinancialYearMonths,
  getMonthYearPairsForFY,
} from "./financialYearUtils";

type ManagerTargetRow = {
  id: string;
  month: number;
  year: number;
  existing_target: number;
  new_ac_target: number;
};

export function OverallTargetsTab() {
  const { filterFinancialYear } = useOutletContext<TargetsOutletContext>();
  const { canMutatePortal } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<ManagerTargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<ManagerTargetRow | null>(null);
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [existingTarget, setExistingTarget] = useState<string>("");
  const [newAcTarget, setNewAcTarget] = useState<string>("");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<
    Array<{
      rowNumber: number;
      data: Record<string, string>;
      isValid: boolean;
      errors: string[];
    }>
  >([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const monthColumns = useMemo(
    () => getFinancialYearMonths(filterFinancialYear),
    [filterFinancialYear]
  );
  const pairs = useMemo(
    () => getMonthYearPairsForFY(filterFinancialYear),
    [filterFinancialYear]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const yearMatch = filterFinancialYear.match(/FY(\d{2})/);
      if (!yearMatch) {
        setRows([]);
        return;
      }
      const fyStart = 2000 + parseInt(yearMatch[1], 10);
      const fyEnd = fyStart + 1;

      const { data, error } = await supabase
        .from("manager_targets")
        .select("id, month, year, existing_target, new_ac_target")
        .gte("year", fyStart)
        .lte("year", fyEnd);

      if (error) throw error;

      const allowed = new Set(pairs.map((p) => `${p.year}-${p.month}`));
      const filtered = (data || []).filter((r: ManagerTargetRow) =>
        allowed.has(`${r.year}-${r.month}`)
      );
      setRows(filtered as ManagerTargetRow[]);
    } catch (e: unknown) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to load overall targets.",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
    // toast is stable; omit from deps to avoid effect churn if it ever changes identity
  }, [filterFinancialYear, pairs]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowMap = new Map<string, ManagerTargetRow>();
  rows.forEach((r) => {
    rowMap.set(`${r.year}-${String(r.month).padStart(2, "0")}`, r);
  });

  const totals = useMemo(() => {
    return monthColumns.reduce(
      (acc, col) => {
        const row = rowMap.get(col.key);
        const existing = Number(row?.existing_target ?? 0);
        const newAc = Number(row?.new_ac_target ?? 0);
        acc.existing += existing;
        acc.newAc += newAc;
        acc.total += existing + newAc;
        return acc;
      },
      { existing: 0, newAc: 0, total: 0 }
    );
  }, [monthColumns, rows]);

  const openAdd = () => {
    setEditing(null);
    setMonth("");
    setYear("");
    setExistingTarget("");
    setNewAcTarget("");
    setFormOpen(true);
  };

  const openAddForMonth = (col: { month: number; year: number }) => {
    setEditing(null);
    setMonth(String(col.month));
    setYear(String(col.year));
    setExistingTarget("0");
    setNewAcTarget("0");
    setFormOpen(true);
  };

  const openEdit = (r: ManagerTargetRow) => {
    setEditing(r);
    setMonth(String(r.month));
    setYear(String(r.year));
    setExistingTarget(String(r.existing_target ?? 0));
    setNewAcTarget(String(r.new_ac_target ?? 0));
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const ex = parseFloat(existingTarget);
    const na = parseFloat(newAcTarget);
    if (!m || !y || Number.isNaN(ex) || Number.isNaN(na) || ex < 0 || na < 0) {
      toast({
        title: "Validation",
        description: "Enter valid month, year, and non-negative targets.",
        variant: "destructive",
      });
      return;
    }

    const key = `${y}-${String(m).padStart(2, "0")}`;
    const inFy = pairs.some(
      (p) => p.month === m && p.year === y
    );
    if (!inFy) {
      toast({
        title: "Validation",
        description: `Month/year must fall within ${formatFYLabel(filterFinancialYear)}.`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not signed in");

      if (editing) {
        const { error } = await supabase
          .from("manager_targets")
          .update({
            month: m,
            year: y,
            existing_target: ex,
            new_ac_target: na,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const existingId = rowMap.get(key)?.id;
        if (existingId) {
          const { error } = await supabase
            .from("manager_targets")
            .update({
              existing_target: ex,
              new_ac_target: na,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("manager_targets").insert({
            month: m,
            year: y,
            existing_target: ex,
            new_ac_target: na,
          });
          if (error) throw error;
        }
      }

      toast({ title: "Saved", description: "Overall targets updated." });
      setFormOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r: ManagerTargetRow) => {
    if (
      !confirm(
        `Delete overall targets for ${r.month}/${r.year}? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase
        .from("manager_targets")
        .delete()
        .eq("id", r.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Targets removed for that month." });
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const downloadTemplate = () => {
    const headers = ["Month", "Year", "Existing Target", "New AC Target"];
    const lines = [headers.join(",")];
    monthColumns.forEach((col) => {
      lines.push(
        [
          String(col.month),
          String(col.year),
          "0",
          "0",
        ].join(",")
      );
    });
    downloadCSV(
      lines.join("\n"),
      `overall_targets_template_${filterFinancialYear}.csv`
    );
    toast({ title: "Template downloaded" });
  };

  const runCsvPreview = async (file: File) => {
    try {
      const text = await file.text();
      const data = parseCSV(text);
      if (data.length === 0) {
        toast({
          title: "Error",
          description: "Empty CSV",
          variant: "destructive",
        });
        return;
      }
      const preview = data.map((row, i) => {
        const rowNumber = i + 2;
        const errors: string[] = [];
        const mo = parseInt(row["Month"]?.trim() || "", 10);
        const yr = parseInt(row["Year"]?.trim() || "", 10);
        const exs = row["Existing Target"]?.trim() ?? "";
        const nas = row["New AC Target"]?.trim() ?? "";
        if (!row["Month"]?.trim()) errors.push("Month required");
        else if (mo < 1 || mo > 12) errors.push("Month 1–12");
        if (!row["Year"]?.trim()) errors.push("Year required");
        else if (yr < 2000 || yr > 2100) errors.push("Invalid year");
        const ex = parseFloat(exs);
        const na = parseFloat(nas);
        if (exs === "" || Number.isNaN(ex) || ex < 0)
          errors.push("Existing Target must be a number ≥ 0");
        if (nas === "" || Number.isNaN(na) || na < 0)
          errors.push("New AC Target must be a number ≥ 0");
        const inFy =
          !Number.isNaN(mo) &&
          !Number.isNaN(yr) &&
          pairs.some((p) => p.month === mo && p.year === yr);
        if (!inFy && errors.length === 0)
          errors.push(`Row must be within ${formatFYLabel(filterFinancialYear)}`);
        return {
          rowNumber,
          data: row as Record<string, string>,
          isValid: errors.length === 0,
          errors,
        };
      });
      setCsvRows(preview);
      setCsvFile(file);
      setCsvPreviewOpen(true);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: "Could not parse CSV",
        variant: "destructive",
      });
    }
  };

  const confirmCsvUpload = async () => {
    if (!csvFile) return;
    setUploading(true);
    try {
      const text = await csvFile.text();
      const data = parseCSV(text);
      const { error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error("Not signed in");

      for (const row of data) {
        const mo = parseInt(row["Month"]?.trim() || "", 10);
        const yr = parseInt(row["Year"]?.trim() || "", 10);
        const ex = parseFloat(row["Existing Target"]?.trim() || "0");
        const na = parseFloat(row["New AC Target"]?.trim() || "0");
        if (!pairs.some((p) => p.month === mo && p.year === yr)) continue;

        const { data: existing } = await supabase
          .from("manager_targets")
          .select("id")
          .eq("month", mo)
          .eq("year", yr)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await supabase
            .from("manager_targets")
            .update({
              existing_target: ex,
              new_ac_target: na,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("manager_targets").insert({
            month: mo,
            year: yr,
            existing_target: ex,
            new_ac_target: na,
          });
          if (error) throw error;
        }
      }

      toast({ title: "Upload complete" });
      setCsvPreviewOpen(false);
      setBulkOpen(false);
      setCsvFile(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canMutatePortal ? (
          <>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  CSV upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Overall targets CSV</DialogTitle>
                  <DialogDescription>
                    Download the template for {formatFYLabel(filterFinancialYear)}
                    , fill values, then upload.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-2">
                  <Button type="button" variant="outline" onClick={downloadTemplate}>
                    Download template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".csv";
                      input.onchange = (ev) => {
                        const f = (ev.target as HTMLInputElement).files?.[0];
                        if (f) void runCsvPreview(f);
                      };
                      input.click();
                    }}
                  >
                    Choose CSV
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add / update row
            </Button>
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Overall targets ({formatFYLabel(filterFinancialYear)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-gradient-to-b from-muted/50 to-muted/25 p-1 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_24px_-8px_rgba(0,0,0,0.35)]">
              <Table
                className="table-fixed border-separate border-spacing-0 [&_td]:px-3 [&_th]:px-3 [&_td]:py-3.5 [&_th]:py-3.5 [&_tbody_tr]:border-0 [&_thead_tr]:border-0"
              >
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 bg-transparent hover:bg-transparent">
                    <TableHead className="w-[23%] rounded-tl-xl text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Month
                    </TableHead>
                    <TableHead className="w-[21%] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Existing target
                    </TableHead>
                    <TableHead
                      className={cn(
                        "w-[21%] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      )}
                    >
                      New AC target
                    </TableHead>
                    <TableHead
                      className={cn(
                        "w-[21%] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                        !canMutatePortal && "rounded-tr-xl"
                      )}
                    >
                      Total
                    </TableHead>
                    {canMutatePortal ? (
                      <TableHead className="w-[14%] rounded-tr-xl pl-6 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Actions
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthColumns.map((col, idx) => {
                    const key = col.key;
                    const r = rowMap.get(key);
                    const hasValue =
                      !!r &&
                      (Number(r.existing_target) > 0 ||
                        Number(r.new_ac_target) > 0);
                    const isLast = idx === monthColumns.length - 1;
                    return (
                      <TableRow
                        key={key}
                        className={cn(
                          "border-0 transition-colors duration-200 hover:bg-background/60",
                          idx % 2 === 1 && "bg-background/25"
                        )}
                      >
                        <TableCell
                          className={cn(
                            "font-medium text-foreground/90",
                            isLast && "rounded-bl-xl"
                          )}
                        >
                          {col.label}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r
                            ? formatNumber(Math.round(Number(r.existing_target)))
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums text-muted-foreground",
                            isLast && !canMutatePortal && "rounded-br-none"
                          )}
                        >
                          {r
                            ? formatNumber(Math.round(Number(r.new_ac_target)))
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums text-muted-foreground",
                            isLast && !canMutatePortal && "rounded-br-none"
                          )}
                        >
                          {r
                            ? formatNumber(
                                Math.round(
                                  Number(r.existing_target) + Number(r.new_ac_target)
                                )
                              )
                            : "—"}
                        </TableCell>
                        {canMutatePortal ? (
                          <TableCell
                            className={cn(
                              "bg-gradient-to-r from-transparent via-muted/20 to-transparent pl-6 text-center",
                              isLast && "rounded-br-xl"
                            )}
                          >
                            {!hasValue ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="gap-1.5 rounded-full px-4 shadow-none"
                                onClick={() =>
                                  r ? openEdit(r) : openAddForMonth(col)
                                }
                              >
                                <Plus className="h-4 w-4" />
                                Add targets
                              </Button>
                            ) : (
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1.5 rounded-full px-4 shadow-none"
                                  onClick={() => openEdit(r!)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1.5 rounded-full px-4 text-destructive shadow-none hover:bg-destructive/15 hover:text-destructive"
                                  onClick={() => handleDelete(r!)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-0 bg-background/60 font-semibold">
                    <TableCell className="rounded-bl-xl text-foreground">Total</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatNumber(Math.round(totals.existing))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatNumber(Math.round(totals.newAc))}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums text-foreground",
                        !canMutatePortal && "rounded-br-xl"
                      )}
                    >
                      {formatNumber(Math.round(totals.total))}
                    </TableCell>
                    {canMutatePortal ? (
                      <TableCell className="rounded-br-xl pl-6 text-center text-muted-foreground">
                        —
                      </TableCell>
                    ) : null}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit overall target" : "Add overall target"}
              </DialogTitle>
              <DialogDescription>
                Values apply to {formatFYLabel(filterFinancialYear)}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Month in FY</Label>
                <Select
                  value={month && year ? `${month}-${year}` : ""}
                  onValueChange={(v) => {
                    const [mo, yr] = v.split("-");
                    setMonth(mo);
                    setYear(yr);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthColumns.map((col) => (
                      <SelectItem
                        key={col.key}
                        value={`${col.month}-${col.year}`}
                      >
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ex">Existing target</Label>
                <Input
                  id="ex"
                  type="number"
                  min={0}
                  step="0.01"
                  value={existingTarget}
                  onChange={(e) => setExistingTarget(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="na">New AC target</Label>
                <Input
                  id="na"
                  type="number"
                  min={0}
                  step="0.01"
                  value={newAcTarget}
                  onChange={(e) => setNewAcTarget(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CSVPreviewDialog
        open={csvPreviewOpen}
        onOpenChange={setCsvPreviewOpen}
        rows={csvRows}
        onConfirm={confirmCsvUpload}
        onCancel={() => {
          setCsvPreviewOpen(false);
          setCsvFile(null);
        }}
        loading={uploading}
        title="Upload overall targets"
      />
    </div>
  );
}
