import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/edge-function-errors";
import { TeamSelectItems } from "@/components/TeamSelectItems";
import { formatTeamLabel } from "@/lib/teamLabels";

import { type Team } from "@/hooks/useAuth";

type AppRole = "kam" | "manager" | "leadership" | "superadmin" | "team_admin" | "nso";

interface EditUserDialogProps {
  user: {
    id: string;
    email: string;
    role: string | null;
    team: string | null;
    full_name?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
  lockedTeam?: Team | null;
  isGlobalAdmin?: boolean;
}

const ALL_ROLES: AppRole[] = ["kam", "manager", "leadership", "superadmin", "team_admin", "nso"];
const TEAM_SCOPED_ROLES: AppRole[] = ["kam", "manager", "leadership", "team_admin", "nso"];
const VALID_TEAMS: Team[] = ["ce", "staffing", "experts"];

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated,
  lockedTeam = null,
  isGlobalAdmin = true,
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<AppRole | "">("");
  const [team, setTeam] = useState<Team | "">("");
  const { toast } = useToast();

  const assignableRoles = isGlobalAdmin ? ALL_ROLES : TEAM_SCOPED_ROLES;

  useEffect(() => {
    if (user) {
      const userRole = ALL_ROLES.includes(user.role as AppRole) ? (user.role as AppRole) : "";
      setRole(assignableRoles.includes(userRole as AppRole) ? userRole : "");
      if (lockedTeam) {
        setTeam(lockedTeam);
      } else if (user.role === "superadmin") {
        setTeam("");
      } else {
        setTeam(VALID_TEAMS.includes(user.team as Team) ? (user.team as Team) : "");
      }
    }
  }, [user, lockedTeam, assignableRoles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !role) return;

    const effectiveTeam = lockedTeam ?? (role === "superadmin" ? null : team);
    if (role !== "superadmin" && !effectiveTeam) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-user", {
        body: {
          user_id: user.id,
          role,
          team: effectiveTeam,
        },
      });

      if (error) {
        throw new Error(await parseEdgeFunctionError(error, data));
      }

      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String(data.error));
      }

      toast({
        title: "Success!",
        description: "User updated successfully.",
      });

      onOpenChange(false);
      onUserUpdated();
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const showTeamField = role !== "superadmin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update role and team for {user.full_name || user.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                {user.email}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)} required>
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.includes("kam") && (
                    <SelectItem value="kam">Key Account Manager (KAM)</SelectItem>
                  )}
                  {assignableRoles.includes("manager") && (
                    <SelectItem value="manager">Manager</SelectItem>
                  )}
                  {assignableRoles.includes("leadership") && (
                    <SelectItem value="leadership">Leadership</SelectItem>
                  )}
                  {assignableRoles.includes("team_admin") && (
                    <SelectItem value="team_admin">Team Admin</SelectItem>
                  )}
                  {assignableRoles.includes("superadmin") && (
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  )}
                  {assignableRoles.includes("nso") && (
                    <SelectItem value="nso">New Sales Officer (NSO)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {showTeamField && (
              <div className="grid gap-2">
                <Label htmlFor="edit-team">Team *</Label>
                {lockedTeam ? (
                  <div className="rounded-md bg-muted px-3 py-2 text-sm">
                    {formatTeamLabel(lockedTeam)}
                  </div>
                ) : (
                  <Select value={team} onValueChange={(v) => setTeam(v as Team)} required>
                    <SelectTrigger id="edit-team">
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      <TeamSelectItems />
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !role || (showTeamField && !lockedTeam && !team)}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
