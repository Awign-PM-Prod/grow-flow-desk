import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InviteUserDialog } from "@/components/InviteUserDialog";

interface NsoProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export default function AdminNSOs() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [nsoList, setNsoList] = useState<NsoProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchNSOs = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("role", "nso")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setNsoList(data || []);
    } catch (error: unknown) {
      console.error("Error fetching NSO users:", error);
      toast({
        title: "Error",
        description: "Failed to load NSO users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    fetchNSOs();
  }, [authLoading, isSuperAdmin, navigate]);

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const q = searchTerm.toLowerCase();
  const filteredNSOs = nsoList.filter(
    (row) =>
      row.email.toLowerCase().includes(q) ||
      (row.full_name && row.full_name.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
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
          <h1 className="text-3xl font-bold tracking-tight">New Sales Officers (NSO)</h1>
          <p className="text-muted-foreground">
            NSOs are portal users with the NSO role. Invite them here; they sign in like other users and
            receive the same welcome email. Edit roles or reset access from User Management.
          </p>
        </div>
        <InviteUserDialog onUserInvited={fetchNSOs} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>NSO users</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNSOs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {searchTerm
                        ? "No NSO users match your search"
                        : "No NSO users yet. Use Invite User and choose the NSO role."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNSOs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.full_name?.trim() || "—"}
                      </TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
