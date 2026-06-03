import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RatingScaleProps = {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  required?: boolean;
  className?: string;
};

export function RatingScale({
  label,
  value,
  onChange,
  required = false,
  className,
}: RatingScaleProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <Label className="text-base font-medium leading-snug">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex items-end gap-2 sm:gap-4">
        <span className="hidden sm:block text-xs text-muted-foreground w-24 shrink-0 pb-1">
          Very Unsatisfied
        </span>
        <div className="flex flex-1 justify-between gap-1 sm:gap-3 min-w-0">
          {[1, 2, 3, 4, 5].map((rating) => (
            <label
              key={rating}
              className="flex flex-col items-center gap-1.5 cursor-pointer flex-1 min-w-0"
            >
              <span className="text-sm font-medium text-foreground">{rating}</span>
              <input
                type="radio"
                name={`rating-${label}`}
                value={rating}
                checked={value === rating}
                onChange={() => onChange(rating)}
                className="h-4 w-4 accent-primary border-muted-foreground"
                required={required && value === null}
              />
            </label>
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
