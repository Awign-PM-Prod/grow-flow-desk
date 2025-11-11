import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function UserInviteInfo() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>How User Invites Work</AlertTitle>
      <AlertDescription className="mt-2 space-y-2 text-sm">
        <p>
          <strong>1. Invite:</strong> Click "Invite User" to send an invitation email with a secure setup link.
        </p>
        <p>
          <strong>2. Email:</strong> The user receives an email with instructions to set their password.
        </p>
        <p>
          <strong>3. Setup:</strong> They click the link, which takes them to the auth page to create their password.
        </p>
        <p>
          <strong>4. Access:</strong> Once set up, they can log in and access the system with their assigned role.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Note: Make sure you have configured your Resend account and verified your sending domain.
        </p>
      </AlertDescription>
    </Alert>
  );
}
