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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const nsoSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100, "First name must be less than 100 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name must be less than 100 characters"),
  mailId: z.string().trim().email("Invalid email address").max(255, "Mail ID must be less than 255 characters"),
});

interface NSOData {
  id: string;
  first_name: string;
  last_name: string;
  mail_id: string;
}

interface EditNSODialogProps {
  nso: NSOData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNSOUpdated: () => void;
}

export function EditNSODialog({ nso, open, onOpenChange, onNSOUpdated }: EditNSODialogProps) {
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mailId, setMailId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (nso) {
      setFirstName(nso.first_name);
      setLastName(nso.last_name);
      setMailId(nso.mail_id);
    } else {
      setFirstName("");
      setLastName("");
      setMailId("");
    }
  }, [nso, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nso) return;

    setLoading(true);

    try {
      // Validate inputs
      const validationResult = nsoSchema.safeParse({
        firstName,
        lastName,
        mailId,
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

      // Check if mail_id is being changed and if the new one already exists
      if (mailId !== nso.mail_id) {
        const { data: existing } = await supabase
          .from("new_sales_officers")
          .select("id")
          .eq("mail_id", validationResult.data.mailId)
          .single();

        if (existing) {
          throw new Error("A New Sales Officer with this Mail ID already exists.");
        }
      }

      // Update NSO
      const { error } = await supabase
        .from("new_sales_officers")
        .update({
          first_name: validationResult.data.firstName,
          last_name: validationResult.data.lastName,
          mail_id: validationResult.data.mailId,
        })
        .eq("id", nso.id);

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation
          throw new Error("A New Sales Officer with this Mail ID already exists.");
        }
        throw error;
      }

      toast({
        title: "Success!",
        description: `New Sales Officer ${validationResult.data.firstName} ${validationResult.data.lastName} has been updated.`,
      });

      onOpenChange(false);
      onNSOUpdated();
    } catch (error: any) {
      console.error("Error updating NSO:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update New Sales Officer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit New Sales Officer</DialogTitle>
            <DialogDescription>
              Update the details of this New Sales Officer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editFirstName">First Name *</Label>
              <Input
                id="editFirstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editLastName">Last Name *</Label>
              <Input
                id="editLastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editMailId">Mail ID *</Label>
              <Input
                id="editMailId"
                type="email"
                placeholder="john.doe@company.com"
                value={mailId}
                onChange={(e) => setMailId(e.target.value)}
                required
                maxLength={255}
              />
              <p className="text-xs text-muted-foreground">
                Mail ID must be unique. This will be used to identify the NSO.
              </p>
            </div>
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
            <Button type="submit" disabled={loading || !firstName || !lastName || !mailId}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update NSO"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



