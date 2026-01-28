import { useState } from "react";
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
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const nsoSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100, "First name must be less than 100 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name must be less than 100 characters"),
  mailId: z.string().trim().email("Invalid email address").max(255, "Mail ID must be less than 255 characters"),
});

interface AddNSODialogProps {
  onNSOAdded: () => void;
}

export function AddNSODialog({ onNSOAdded }: AddNSODialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mailId, setMailId] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Insert NSO
      const { error } = await supabase
        .from("new_sales_officers")
        .insert({
          first_name: validationResult.data.firstName,
          last_name: validationResult.data.lastName,
          mail_id: validationResult.data.mailId,
          created_by: user.id,
        });

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation
          throw new Error("A New Sales Officer with this Mail ID already exists.");
        }
        throw error;
      }

      toast({
        title: "Success!",
        description: `New Sales Officer ${validationResult.data.firstName} ${validationResult.data.lastName} has been created.`,
      });

      // Reset form
      setFirstName("");
      setLastName("");
      setMailId("");
      setOpen(false);
      onNSOAdded();
    } catch (error: any) {
      console.error("Error adding NSO:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add New Sales Officer. Please try again.",
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
          <UserPlus className="h-4 w-4" />
          Add NSO
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Sales Officer</DialogTitle>
            <DialogDescription>
              Create a new New Sales Officer. Note: This is not a user account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mailId">Mail ID *</Label>
              <Input
                id="mailId"
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
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !firstName || !lastName || !mailId}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create NSO"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



