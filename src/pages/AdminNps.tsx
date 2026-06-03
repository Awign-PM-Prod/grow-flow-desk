import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NpsResponseDetailView } from "@/components/nps/NpsResponseDetailView";
import { convertToCSV, downloadCSV } from "@/lib/csv-export";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ClipboardList, Download, Loader2, Mail, X } from "lucide-react";
import { getAppSiteUrl } from "@/lib/app-site-url";
import {
  filterNpsResponses,
  NPS_RESPONSE_CSV_HEADERS,
  npsResponsesToCsvRows,
  type NpsResponseFilters,
  type NpsResponseListRow,
  type NpsResponseRecord,
} from "@/lib/nps";

type NpsResponseQueryRow = NpsResponseRecord & {
  contacts: {
    first_name: string;
    last_name: string;
    department: string;
    account_id: string;
    accounts: { id: string; name: string } | { id: string; name: string }[] | null;
  } | null;
};

function mapQueryRow(row: NpsResponseQueryRow): NpsResponseListRow {
  const contact = row.contacts;
  const accountRaw = contact?.accounts;
  const account =
    accountRaw && !Array.isArray(accountRaw)
      ? accountRaw
      : Array.isArray(accountRaw)
        ? accountRaw[0]
        : null;

  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : null;

  const { contacts: _contacts, ...record } = row;

  return {
    ...record,
    contact_name: contactName || null,
    account_id: contact?.account_id ?? account?.id ?? null,
    account_name: account?.name ?? null,
    department: contact?.department ?? null,
  };
}

const EMPTY_FILTERS: NpsResponseFilters = {
  accountId: "all",
  contactId: "all",
  submittedDates: [],
};

function formatSubmittedDateLabel(dates: Date[]): string {
  if (dates.length === 0) return "Submitted date";
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  if (sorted.length === 1) {
    return format(sorted[0], "LLL dd, y");
  }
  return `${format(sorted[0], "LLL dd, y")} – ${format(sorted[1], "LLL dd, y")}`;
}

function hasActiveFilters(filters: NpsResponseFilters): boolean {
  return (
    filters.accountId !== "all" ||
    filters.contactId !== "all" ||
    filters.submittedDates.length > 0
  );
}

export default function AdminNps() {
  const navigate = useNavigate();
  const { canManageUsers, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [enabledCount, setEnabledCount] = useState<number | null>(null);
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [responses, setResponses] = useState<NpsResponseListRow[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<NpsResponseListRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState<NpsResponseFilters>(EMPTY_FILTERS);

  const filteredResponses = useMemo(
    () => filterNpsResponses(responses, filters),
    [responses, filters],
  );

  const accountOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of responses) {
      if (row.account_id && row.account_name) {
        byId.set(row.account_id, row.account_name);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [responses]);

  const contactOptions = useMemo(() => {
    const byId = new Map<string, { name: string; accountId: string | null }>();
    for (const row of responses) {
      if (!row.contact_id) continue;
      if (filters.accountId !== "all" && row.account_id !== filters.accountId) continue;
      byId.set(row.contact_id, {
        name: row.contact_name || row.email,
        accountId: row.account_id,
      });
    }
    return [...byId.entries()]
      .map(([id, { name }]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [responses, filters.accountId]);

  const filtersActive = hasActiveFilters(filters);

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

  const fetchResponses = useCallback(async () => {
    setLoadingResponses(true);
    try {
      const { data, error } = await supabase
        .from("nps_responses")
        .select(
          `
          id,
          invite_id,
          contact_id,
          email,
          submitted_at,
          satisfaction_services,
          satisfaction_project_execution,
          gig_workforce_quality,
          poc_overall_communication,
          poc_escalation_handling,
          poc_availability,
          poc_proactive_approach,
          poc_timely_response,
          poc_requirement_understanding,
          referral_intent,
          leadership_meeting,
          services_meet_needs,
          improve_suggestions,
          other_comments,
          contacts (
            account_id,
            first_name,
            last_name,
            department,
            accounts ( id, name )
          )
        `,
        )
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      setResponses((data as NpsResponseQueryRow[] | null)?.map(mapQueryRow) ?? []);
    } catch (error) {
      console.error("Error loading NPS responses:", error);
      setResponses([]);
      toast({
        title: "Could not load responses",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingResponses(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!canManageUsers) {
      navigate("/dashboard", { replace: true });
      return;
    }
    void fetchStats();
    void fetchResponses();
  }, [authLoading, canManageUsers, navigate, fetchResponses]);

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
      void fetchResponses();
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

  const openResponseDetail = (row: NpsResponseListRow) => {
    setSelectedResponse(row);
    setDetailOpen(true);
  };

  const formatSubmittedAt = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleAccountFilterChange = (accountId: string) => {
    setFilters((prev) => ({
      ...prev,
      accountId,
      contactId: "all",
    }));
  };

  const handleSubmittedDatesSelect = (dates: Date[] | undefined) => {
    const next = dates ?? [];
    setFilters((prev) => ({
      ...prev,
      submittedDates: next.length > 2 ? next.slice(-2) : next,
    }));
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const handleExportCsv = () => {
    const rows = filtersActive ? filteredResponses : responses;
    if (rows.length === 0) {
      toast({
        title: "Nothing to export",
        description: filtersActive
          ? "No responses match the current filters."
          : "There are no responses to export yet.",
        variant: "destructive",
      });
      return;
    }
    const csv = convertToCSV(npsResponsesToCsvRows(rows), NPS_RESPONSE_CSV_HEADERS);
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = filtersActive ? "filtered" : "all";
    downloadCSV(csv, `nps-responses-${suffix}-${stamp}.csv`);
    toast({
      title: "Export started",
      description: `Exported ${rows.length} response${rows.length === 1 ? "" : "s"}.`,
    });
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Recorded responses</CardTitle>
              <CardDescription>
                Click a row to view the full submission.{" "}
                {loadingResponses
                  ? ""
                  : filtersActive
                    ? `Showing ${filteredResponses.length} of ${responses.length}.`
                    : `${responses.length} total.`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              disabled={loadingResponses || responses.length === 0}
              onClick={handleExportCsv}
            >
              <Download className="mr-2 h-4 w-4" />
              {filtersActive ? "Export Filtered Responses" : "Export CSV"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="space-y-1.5 min-w-[200px] flex-1">
              <Label className="text-sm">Account</Label>
              <Select value={filters.accountId} onValueChange={handleAccountFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-[200px] flex-1">
              <Label className="text-sm">Contact</Label>
              <Select
                value={filters.contactId}
                onValueChange={(contactId) =>
                  setFilters((prev) => ({ ...prev, contactId }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All contacts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All contacts</SelectItem>
                  {contactOptions.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Submitted date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`min-w-[220px] justify-start text-left font-normal ${
                      filters.submittedDates.length > 0 ? "border-primary/50 bg-primary/5" : ""
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{formatSubmittedDateLabel(filters.submittedDates)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Select up to 2 dates</span>
                      {filters.submittedDates.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, submittedDates: [] }))
                          }
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      One date: responses on that day. Two dates: inclusive range.
                    </p>
                  </div>
                  <Calendar
                    mode="multiple"
                    selected={filters.submittedDates}
                    onSelect={handleSubmittedDatesSelect}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {filtersActive ? (
              <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            ) : null}
          </div>

          {loadingResponses ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResponses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {responses.length === 0
                        ? "No responses yet."
                        : "No responses match the current filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResponses.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openResponseDetail(row)}
                    >
                      <TableCell className="font-medium">{row.email}</TableCell>
                      <TableCell>{row.contact_name ?? "—"}</TableCell>
                      <TableCell>{row.account_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatSubmittedAt(row.submitted_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="text-left pb-4 border-b">
            <SheetTitle>Awign Feedback Survey</SheetTitle>
            {selectedResponse ? (
              <SheetDescription>
                Submitted {formatSubmittedAt(selectedResponse.submitted_at)}
              </SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="py-6">
            {selectedResponse ? (
              <NpsResponseDetailView
                response={selectedResponse}
                contactName={selectedResponse.contact_name}
                accountName={selectedResponse.account_name}
                department={selectedResponse.department}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

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
