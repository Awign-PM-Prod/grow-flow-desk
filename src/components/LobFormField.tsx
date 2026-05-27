import type { ReactNode } from "react";
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
  getFixedLobForTeam,
  isLobLockedForTeam,
} from "@/lib/teamLob";
import type { Team } from "@/hooks/useAuth";

interface LobFormFieldProps {
  id?: string;
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  allowedLobOptions: string[];
  team: Team | null;
  isGlobalAdmin: boolean;
  required?: boolean;
  placeholder?: string;
}

export function LobFormField({
  id = "lob",
  label = (
    <>
      LoB <span className="text-destructive">*</span>
    </>
  ),
  value,
  onChange,
  allowedLobOptions,
  team,
  isGlobalAdmin,
  required = true,
  placeholder = "Select LoB",
}: LobFormFieldProps) {
  const locked = isLobLockedForTeam(team, isGlobalAdmin);
  const fixedLob = getFixedLobForTeam(team, isGlobalAdmin);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {locked && fixedLob ? (
        <Input
          id={id}
          value={fixedLob}
          readOnly
          className="bg-muted"
          required={required}
        />
      ) : (
        <Select
          value={value}
          onValueChange={onChange}
          required={required}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {allowedLobOptions.map((lob) => (
              <SelectItem key={lob} value={lob}>
                {lob}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
