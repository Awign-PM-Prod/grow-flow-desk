import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Team } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseEdgeFunctionError } from "@/lib/edge-function-errors";
import { TeamSelectItems } from "@/components/TeamSelectItems";
import { formatTeamLabel, parseTeamValue } from "@/lib/teamLabels";

interface KamTeamRow {
  id: string;
  email: string;
  full_name: string | null;
  team: string | null;
}

export default function AdminKamTeamMapping() {
  const navigate = useNavigate();
  const {
    canManageUsers,
    isSuperAdmin,
    isTeamAdmin,
    team: adminTeam,
    loading: authLoading,
  } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<"all" | Team>("all");
  const [rows, setRows] = useState<KamTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isTeamAdmin && adminTeam) {
      setTeamFilter(adminTeam);
    }
  }, [isTeamAdmin, adminTeam]);

  const fetchKams = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, team")
        .eq("role", "kam")
        .order("full_name", { ascending: true, nullsFirst: false });

      if (error) throw error;

      setRows(data || []);
    } catch (error: unknown) {
      console.error("Error fetching KAM team mapping:", error);
      toast({
        title: "Error",
        description: "Failed to load KAM team mapping. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!canManageUsers) {
      navigate("/dashboard", { replace: true });
      return;
    }
    fetchKams();
  }, [authLoading, canManageUsers, navigate]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        row.email.toLowerCase().includes(q) ||
        (row.full_name && row.full_name.toLowerCase().includes(q));
      const matchesTeam =
        teamFilter === "all" ? true : row.team === teamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [rows, searchTerm, teamFilter]);

  const teamSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of filteredRows) {
      const key = row.team || "unassigned";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [filteredRows]);

  const handleTeamChange = async (row: KamTeamRow, newTeamValue: string) => {
    const newTeam = parseTeamValue(newTeamValue);
    if (!newTeam || row.team === newTeam) return;

    setSavingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("update-user", {
        body: {
          user_id: row.id,
          role: "kam",
          team: newTeam,
        },
      });

      if (error) {
        throw new Error(await parseEdgeFunctionError(error, data));
      }

      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String(data.error));
      }

      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, team: newTeam } : r))
      );

      toast({
        title: "Team updated",
        description: `${row.full_name?.trim() || row.email} is now on ${formatTeamLabel(newTeam)}.`,
      });
    } catch (error: unknown) {
      console.error("Error updating KAM team:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update KAM team. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading || !canManageUsers) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/users")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to User Management
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            KAM – Team Mapping
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View and update which team each Key Account Manager belongs to.
            {isTeamAdmin && adminTeam
              ? ` You can assign KAMs to ${formatTeamLabel(adminTeam)}.`
              : null}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {isSuperAdmin ? (
              <Select
                value={teamFilter}
                onValueChange={(v) =>
                  setTeamFilter(v as "all" | Team)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <TeamSelectItems includeAll allLabel="All teams" />
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {Object.entries(teamSummary).map(([teamKey, count]) => (
          <Badge key={teamKey} variant="secondary" className="text-sm">
            {teamKey === "unassigned"
              ? "Unassigned"
              : formatTeamLabel(teamKey)}
            : {count}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            KAMs ({filteredRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">S.No.</TableHead>
                  <TableHead>KAM Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Team</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading KAM team mapping...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No KAMs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.full_name?.trim() || "—"}
                      </TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>
                        <Select
                          value={row.team ?? ""}
                          onValueChange={(value) => void handleTeamChange(row, value)}
                          disabled={savingId === row.id}
                        >
                          <SelectTrigger className="w-full min-w-[200px]">
                            {savingId === row.id ? (
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                              </span>
                            ) : (
                              <SelectValue placeholder="Assign team" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {isSuperAdmin ? (
                              <TeamSelectItems />
                            ) : adminTeam ? (
                              <SelectItem value={adminTeam}>
                                {formatTeamLabel(adminTeam)}
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
