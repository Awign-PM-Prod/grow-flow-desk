import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVPreviewRow {
  rowNumber: number;
  data: Record<string, any>;
  isValid: boolean;
  errors: string[];
  willUpdate?: boolean; // Optional flag to indicate if this row will update an existing record
}

interface CSVPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CSVPreviewRow[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  title?: string;
}

export function CSVPreviewDialog({
  open,
  onOpenChange,
  rows,
  onConfirm,
  onCancel,
  loading = false,
  title = "CSV Preview",
}: CSVPreviewDialogProps) {
  if (rows.length === 0) return null;

  const headers = Object.keys(rows[0].data);
  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;
  const updateCount = rows.filter((r) => r.isValid && r.willUpdate).length;
  const newCount = rows.filter((r) => r.isValid && !r.willUpdate).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Valid: {validCount}
            </Badge>
            {updateCount > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Updates: {updateCount}
              </Badge>
            )}
            {newCount > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                New: {newCount}
              </Badge>
            )}
            {invalidCount > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <AlertCircle className="mr-1 h-3 w-3" />
                Invalid: {invalidCount}
              </Badge>
            )}
            <Badge variant="outline">
              Total: {rows.length}
            </Badge>
          </div>

          {/* Error Alert */}
          {invalidCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {invalidCount} row(s) have validation errors. Please review and fix them before proceeding.
                Invalid rows will be highlighted in red.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    {headers.map((header) => (
                      <TableHead key={header} className="min-w-[120px]">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.rowNumber}
                      className={
                        !row.isValid 
                          ? "bg-red-50 hover:bg-red-100" 
                          : row.willUpdate 
                            ? "bg-blue-50 hover:bg-blue-100" 
                            : ""
                      }
                    >
                      <TableCell className="font-medium">{row.rowNumber}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          row.willUpdate ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              Update
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              New
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Invalid
                          </Badge>
                        )}
                      </TableCell>
                      {headers.map((header) => (
                        <TableCell key={header} className="max-w-[200px] truncate" title={String(row.data[header] || "")}>
                          {row.data[header] || <span className="text-muted-foreground italic">(empty)</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Error Details */}
          {invalidCount > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Error Details:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {rows
                  .filter((r) => !r.isValid)
                  .map((row) => (
                    <div key={row.rowNumber} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                      <strong>Row {row.rowNumber}:</strong> {row.errors.join("; ")}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading || invalidCount > 0}
          >
            {loading 
              ? "Uploading..." 
              : `Upload ${validCount} Entry(s)${updateCount > 0 ? ` (${updateCount} update${updateCount > 1 ? 's' : ''}, ${newCount} new)` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

