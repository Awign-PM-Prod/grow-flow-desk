import { SelectItem } from "@/components/ui/select";
import { TEAM_SELECT_OPTIONS } from "@/lib/teamLabels";

type TeamSelectItemsProps = {
  includeAll?: boolean;
  allLabel?: string;
};

export function TeamSelectItems({
  includeAll = false,
  allLabel = "All teams",
}: TeamSelectItemsProps) {
  return (
    <>
      {includeAll ? <SelectItem value="all">{allLabel}</SelectItem> : null}
      {TEAM_SELECT_OPTIONS.map(({ value, label }) => (
        <SelectItem key={value} value={value}>
          {label}
        </SelectItem>
      ))}
    </>
  );
}
