import { useState, useEffect } from "react";
import type { Team } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAppSiteUrl } from "@/lib/app-site-url";
import {
  isPortalInviteEmailEnabled,
  PORTAL_EMAIL_SENDING_DISABLED_MESSAGE,
} from "@/lib/portalEmailSending";
import { TeamSelectItems } from "@/components/TeamSelectItems";
import { formatTeamLabel } from "@/lib/teamLabels";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  fullName: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  role: z.enum(["kam", "manager", "leadership", "superadmin", "team_admin", "nso"], {
    errorMap: () => ({ message: "Please select a valid role" }),
  }),
  team: z.enum(["ce", "staffing", "experts"]).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

interface InviteUserDialogProps {
  onUserInvited: () => void;
  lockedTeam?: Team | null;
  isGlobalAdmin?: boolean;
}

const parseEdgeFunctionError = async (
  error: unknown,
  data: unknown,
): Promise<string> => {
  const fromData =
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : undefined;

  if (fromData) {
    return fromData;
  }

  const errWithContext = error as {
    message?: string;
    context?: { body?: string; json?: () => Promise<unknown>; text?: () => Promise<string> };
  };

  const context = errWithContext.context;

  if (context?.body) {
    try {
      const parsed = JSON.parse(context.body) as { error?: string };
      if (typeof parsed.error === "string") {
        return parsed.error;
      }
    } catch {
      // ignore parse issues and continue with other strategies
    }
  }

  if (typeof context?.json === "function") {
    try {
      const parsed = (await context.json()) as { error?: string; message?: string };
      if (typeof parsed.error === "string") {
        return parsed.error;
      }
      if (typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      // ignore json parse errors and try text fallback
    }
  }

  if (typeof context?.text === "function") {
    try {
      const text = await context.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          if (typeof parsed.error === "string") {
            return parsed.error;
          }
          if (typeof parsed.message === "string") {
            return parsed.message;
          }
        } catch {
          return text;
        }
      }
    } catch {
      // ignore text read errors
    }
  }

  return errWithContext.message || "Failed to invite user";
};

export function InviteUserDialog({
  onUserInvited,
  lockedTeam = null,
  isGlobalAdmin = true,
}: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("");
  const [team, setTeam] = useState<string>(lockedTeam ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (lockedTeam) {
      setTeam(lockedTeam);
    }
  }, [lockedTeam, open]);

  const assignableRoles = isGlobalAdmin
    ? ["kam", "manager", "leadership", "team_admin", "superadmin", "nso"]
    : ["kam", "manager", "leadership", "team_admin", "nso"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      const effectiveTeam = lockedTeam ?? (role === "superadmin" ? undefined : team);

      if (role !== "superadmin" && !effectiveTeam) {
        toast({
          title: "Validation Error",
          description: "Please select a team for this role",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const validationResult = inviteSchema.safeParse({
        email,
        fullName,
        role,
        team: effectiveTeam,
        password,
        confirmPassword,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Call the edge function to invite user
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: validationResult.data.email,
          full_name: validationResult.data.fullName,
          role: validationResult.data.role,
          team: validationResult.data.team ?? null,
          password: validationResult.data.password,
          site_url: getAppSiteUrl(),
          skip_welcome_email: !isPortalInviteEmailEnabled(),
        },
      });

      if (error) {
        const message = await parseEdgeFunctionError(error, data);
        throw new Error(message);
      }

      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
      ) {
        throw new Error((data as { error: string }).error);
      }

      const emailSkipped =
        data &&
        typeof data === "object" &&
        "email_skipped" in data &&
        (data as { email_skipped: unknown }).email_skipped === true;

      toast({
        title: "Success!",
        description: emailSkipped
          ? `User account created for ${email}. ${PORTAL_EMAIL_SENDING_DISABLED_MESSAGE} Share their login credentials manually.`
          : `User account created for ${email}. They will receive an email to verify their account.`,
      });

      // Reset form
      setEmail("");
      setFullName("");
      setRole("");
      setTeam("");
      setPassword("");
      setConfirmPassword("");
      setOpen(false);
      onUserInvited();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Create a new user account. They'll receive an email to verify their account and can then sign in with the password you set.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={role} onValueChange={setRole} required>
                <SelectTrigger id="role">
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
              <p className="text-xs text-muted-foreground">
                {role === "kam" && "Can manage their own accounts and contacts"}
                {role === "manager" && "Can view and manage team performance"}
                {role === "leadership" && "Can view organization-wide metrics"}
                {role === "team_admin" && "Full admin access scoped to their assigned team"}
                {role === "superadmin" && "Full access including user management"}
                {role === "nso" && "Read-only access to mandates and related data where they are assigned as NSO"}
              </p>
            </div>
            {role !== "superadmin" && (
              <div className="grid gap-2">
                <Label htmlFor="team">Team *</Label>
                {lockedTeam ? (
                  <div className="rounded-md bg-muted px-3 py-2 text-sm">
                    {formatTeamLabel(lockedTeam)}
                  </div>
                ) : (
                  <Select value={team} onValueChange={setTeam} required>
                    <SelectTrigger id="team">
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      <TeamSelectItems />
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email || !fullName || !role || !team || !password || !confirmPassword}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
