import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/edge-function-errors";

interface UserSummary {
  id: string;
  email: string;
  full_name?: string;
  role: string | null;
  team: string | null;
}

interface OwnershipCounts {
  mandates_as_kam: number;
  pipeline_deals_as_kam: number;
  monthly_targets_as_kam: number;
  mandates_created: number;
  pipeline_deals_created: number;
  accounts_created: number;
  contacts_created: number;
  monthly_targets_created: number;
  new_sales_officers_created: number;
  deal_status_history_changed: number;
  mandates_as_nso: number;
  monthly_targets_as_nso: number;
  new_sales_officer_by_email: number;
}

interface DeleteUserDialogProps {
  user: UserSummary | null;
  allUsers: UserSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserDeleted: () => void;
}

const IMPACT_LABELS: { key: keyof OwnershipCounts; label: string }[] = [
  { key: "mandates_as_kam", label: "Mandates (assigned as KAM)" },
  { key: "pipeline_deals_as_kam", label: "Pipeline deals (assigned as KAM)" },
  { key: "monthly_targets_as_kam", label: "Monthly targets (assigned as KAM)" },
  { key: "mandates_created", label: "Mandates (created by user)" },
  { key: "pipeline_deals_created", label: "Pipeline deals (created by user)" },
  { key: "accounts_created", label: "Accounts (created by user)" },
  { key: "contacts_created", label: "Contacts (created by user)" },
  { key: "monthly_targets_created", label: "Monthly targets (created by user)" },
  { key: "new_sales_officers_created", label: "NSO records (created by user)" },
  { key: "deal_status_history_changed", label: "Deal status history entries" },
  { key: "mandates_as_nso", label: "Mandates (NSO email mapping)" },
  { key: "monthly_targets_as_nso", label: "Monthly targets (NSO email mapping)" },
  { key: "new_sales_officer_by_email", label: "NSO directory (email match)" },
];

export function DeleteUserDialog({
  user,
  allUsers,
  open,
  onOpenChange,
  onUserDeleted,
}: DeleteUserDialogProps) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [counts, setCounts] = useState<OwnershipCounts | null>(null);
  const [transferToUserId, setTransferToUserId] = useState<string>("");
  const [confirmNoTransferOpen, setConfirmNoTransferOpen] = useState(false);
  const { toast } = useToast();

  const replacementCandidates = useMemo(() => {
    if (!user?.role || !user.team) return [];
    return allUsers.filter(
      (u) =>
        u.id !== user.id &&
        u.role === user.role &&
        u.team === user.team,
    );
  }, [allUsers, user]);

  const impactRows = useMemo(() => {
    if (!counts) return [];
    return IMPACT_LABELS.filter(({ key }) => counts[key] > 0);
  }, [counts]);

  const totalLinked = useMemo(() => {
    if (!counts) return 0;
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
  }, [counts]);

  useEffect(() => {
    if (!open || !user) {
      setCounts(null);
      setTransferToUserId("");
      setConfirmNoTransferOpen(false);
      return;
    }

    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const { data, error } = await supabase.functions.invoke("delete-user", {
          body: { action: "preview", user_id: user.id },
        });

        if (error) {
          throw new Error(await parseEdgeFunctionError(error, data));
        }

        if (data && typeof data === "object" && "error" in data && data.error) {
          throw new Error(String(data.error));
        }

        setCounts((data as { counts: OwnershipCounts }).counts);
      } catch (error: unknown) {
        console.error("Error loading delete preview:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to load user impact preview.",
          variant: "destructive",
        });
        onOpenChange(false);
      } finally {
        setLoadingPreview(false);
      }
    };

    loadPreview();
  }, [open, user, onOpenChange, toast]);

  const performDelete = async (withTransfer: boolean) => {
    if (!user) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: {
          action: "delete",
          user_id: user.id,
          transfer_to_user_id: withTransfer ? transferToUserId : null,
        },
      });

      if (error) {
        throw new Error(await parseEdgeFunctionError(error, data));
      }

      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String(data.error));
      }

      toast({
        title: "User deleted",
        description: withTransfer
          ? "Ownership was transferred and the user was removed."
          : "User was removed and entity mappings were cleared. No records were deleted.",
      });

      setConfirmNoTransferOpen(false);
      onOpenChange(false);
      onUserDeleted();
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteClick = () => {
    if (transferToUserId) {
      performDelete(true);
      return;
    }
    setConfirmNoTransferOpen(true);
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Review linked data for <strong>{user.full_name || user.email}</strong> before
              deleting. Mandates, deals, accounts, and other records will not be deleted.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p>
                  <span className="font-medium">Role:</span>{" "}
                  {user.role ?? "Not set"}
                  {" · "}
                  <span className="font-medium">Team:</span>{" "}
                  {user.team ?? "Not set"}
                </p>
                <p className="mt-2 text-muted-foreground">
                  {totalLinked > 0
                    ? `${totalLinked} linked reference(s) found across the system.`
                    : "No linked references found. The user account can be removed safely."}
                </p>
              </div>

              {impactRows.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base">Data that will be unmapped or transferred</Label>
                  <ul className="rounded-lg border divide-y text-sm">
                    {impactRows.map(({ key, label }) => (
                      <li key={key} className="flex justify-between px-4 py-2">
                        <span>{label}</span>
                        <span className="font-medium tabular-nums">{counts![key]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="transfer-user">
                  Transfer ownership to (optional)
                </Label>
                <Select
                  value={transferToUserId || "__none__"}
                  onValueChange={(v) => setTransferToUserId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="transfer-user">
                    <SelectValue placeholder="Select a user with the same role and team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No transfer</SelectItem>
                    {replacementCandidates.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No eligible users with the same role and team
                      </div>
                    ) : (
                      replacementCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.full_name || candidate.email} ({candidate.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If selected, all KAM assignments, created-by references, and NSO email
                  mappings will move to this user. Entities themselves are never deleted.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={loadingPreview || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : transferToUserId ? (
                "Transfer & Delete User"
              ) : (
                "Delete Without Transfer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmNoTransferOpen} onOpenChange={setConfirmNoTransferOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete without transferring ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {totalLinked > 0 ? (
                <>
                  This will remove the user and clear {totalLinked} mapping(s). Mandates, deals,
                  accounts, and other records will remain but may have no KAM, creator, or NSO
                  assignment until reassigned manually.
                </>
              ) : (
                <>This user has no linked data. Their account will be permanently removed.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                performDelete(false);
              }}
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
