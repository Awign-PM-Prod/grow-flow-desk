import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type NpsRatingDisplayProps = {
  label: string;
  value: number;
  className?: string;
};

export function NpsRatingDisplay({ label, value, className }: NpsRatingDisplayProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <Label className="text-base font-medium leading-snug text-foreground">{label}</Label>
      <div className="flex items-end gap-2 sm:gap-4 pointer-events-none">
        <span className="hidden sm:block text-xs text-muted-foreground w-24 shrink-0 pb-1">
          Very Unsatisfied
        </span>
        <div className="flex flex-1 justify-between gap-1 sm:gap-3 min-w-0">
          {[1, 2, 3, 4, 5].map((rating) => (
            <div key={rating} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <span
                className={cn(
                  "text-sm font-medium",
                  value === rating ? "text-primary" : "text-muted-foreground",
                )}
              >
                {rating}
              </span>
              <div
                className={cn(
                  "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                  value === rating
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 bg-background",
                )}
                aria-hidden
              >
                {value === rating ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <span className="hidden sm:block text-xs text-muted-foreground w-24 shrink-0 pb-1 text-right">
          Very Satisfied
        </span>
      </div>
      <div className="flex justify-between sm:hidden text-xs text-muted-foreground px-1">
        <span>Very Unsatisfied</span>
        <span>Very Satisfied</span>
      </div>
    </div>
  );
}
