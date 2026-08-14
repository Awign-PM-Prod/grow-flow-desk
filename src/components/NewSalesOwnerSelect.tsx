import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatNewSalesOwnerLabelFromPeople,
  type NewSalesOwnerKam,
  type NewSalesOwnerNso,
  type NewSalesOwnerOption,
} from "@/lib/newSalesOwnerOptions";

type NewSalesOwnerSelectProps = {
  value: string;
  options: NewSalesOwnerOption[];
  kams: NewSalesOwnerKam[];
  nsos: NewSalesOwnerNso[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (email: string) => void;
  allowClear?: boolean;
};

export function NewSalesOwnerSelect({
  value,
  options,
  kams,
  nsos,
  open,
  onOpenChange,
  onChange,
  allowClear = true,
}: NewSalesOwnerSelectProps) {
  const kamOptions = options.filter((option) => option.source === "kam");
  const nsoOptions = options.filter((option) => option.source === "nso");

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between"
        >
          {value ? formatNewSalesOwnerLabelFromPeople(value, kams, nsos) : "Select New Sales Owner"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onWheel={(e) => {
          const list = e.currentTarget.querySelector("[cmdk-list]") as HTMLElement | null;
          if (list) {
            list.scrollTop += e.deltaY;
            e.preventDefault();
          }
        }}
      >
        <Command>
          <CommandInput placeholder="Search New Sales Owner..." />
          <CommandEmpty>No New Sales Owner found.</CommandEmpty>
          <CommandList className="max-h-[300px]">
            {allowClear && value ? (
              <CommandItem
                value="__clear_new_sales_owner__"
                onSelect={() => {
                  onChange("");
                  onOpenChange(false);
                }}
              >
                <span className="text-destructive">Remove New Sales Owner</span>
              </CommandItem>
            ) : null}
            {kamOptions.length > 0 ? (
              <CommandGroup heading="KAMs from other teams">
                {kamOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.searchValue}
                    onSelect={() => {
                      onChange(option.email);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{option.full_name?.trim() || option.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.email} · {option.subtitle}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {nsoOptions.length > 0 ? (
              <CommandGroup heading="NSO role">
                {nsoOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.searchValue}
                    onSelect={() => {
                      onChange(option.email);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{option.full_name?.trim() || option.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.email} · {option.subtitle}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
