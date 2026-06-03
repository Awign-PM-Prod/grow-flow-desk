import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Loader2, Mail, ClipboardList } from "lucide-react";
import { getAppSiteUrl } from "@/lib/app-site-url";

export default function AdminNps() {
  const navigate = useNavigate();
  const { canManageUsers, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [enabledCount, setEnabledCount] = useState<number | null>(null);
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const [contactsRes, responsesRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("nps_enabled", true),
        supabase.from("nps_responses").select("id", { count: "exact", head: true }),
      ]);

      if (contactsRes.error) throw contactsRes.error;
      if (responsesRes.error) throw responsesRes.error;

      setEnabledCount(contactsRes.count ?? 0);
      setResponseCount(responsesRes.count ?? 0);
    } catch (error) {
      console.error("Error loading NPS stats:", error);
      setEnabledCount(0);
      setResponseCount(0);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!canManageUsers) {
      navigate("/dashboard", { replace: true });
      return;
    }
    void fetchStats();
  }, [authLoading, canManageUsers, navigate]);

  const handleSendSurveys = async () => {
    setSending(true);
    setConfirmOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("send-nps-surveys", {
        body: {
          site_url: getAppSiteUrl(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const emailsSent = data?.emails_sent ?? 0;
      const total = data?.total_contacts ?? emailsSent;

      toast({
        title: "NPS surveys sent",
        description: `Successfully sent ${emailsSent} of ${total} survey email${total === 1 ? "" : "s"}.`,
      });
      void fetchStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send NPS surveys";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (authLoading || !canManageUsers) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NPS Surveys</h1>
        <p className="text-muted-foreground">
          Send feedback surveys to contacts with NPS enabled. Each contact receives a unique survey link.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">NPS-enabled contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loadingStats ? "—" : enabledCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total responses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loadingStats ? "—" : responseCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send survey emails
          </CardTitle>
          <CardDescription>
            Emails are sent to all contacts where <strong>nps_enabled</strong> is turned on.
            Enable NPS per contact from the Contacts page. Each send creates a new survey link.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={sending || loadingStats || enabledCount === 0}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send NPS Survey to All Enabled Contacts
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => navigate("/contacts")}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Manage contacts
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send NPS survey emails?</AlertDialogTitle>
            <AlertDialogDescription>
              This will email {enabledCount ?? 0} contact{enabledCount === 1 ? "" : "s"} with a link to the
              feedback form. Contacts who already received a survey will get a new link for this round.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSendSurveys()}>
              Send emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
