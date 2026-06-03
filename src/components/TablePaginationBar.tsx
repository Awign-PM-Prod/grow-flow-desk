import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from "@/hooks/useTablePagination";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TablePaginationBarProps = {
  totalItems: number;
  page: number;
  pageSize: TablePageSize;
  totalPages: number;
  startIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: TablePageSize) => void;
  itemLabel?: string;
};

export function TablePaginationBar({
  totalItems,
  page,
  pageSize,
  totalPages,
  startIndex,
  onPageChange,
  onPageSizeChange,
  itemLabel = "rows",
}: TablePaginationBarProps) {
  const from = totalItems === 0 ? 0 : startIndex + 1;
  const to = Math.min(startIndex + pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {totalItems} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v) as TablePageSize)}
          >
            <SelectTrigger className="w-[72px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 min-w-[5rem] text-center">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
