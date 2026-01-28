import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus, Loader2, Edit, Trash2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { AddNSODialog } from "@/components/AddNSODialog";
import { EditNSODialog } from "@/components/EditNSODialog";

interface NSOData {
  id: string;
  first_name: string;
  last_name: string;
  mail_id: string;
  created_at: string;
  updated_at: string;
}

export default function AdminNSOs() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [nsoList, setNsoList] = useState<NSOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNSO, setEditingNSO] = useState<NSOData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingNSO, setDeletingNSO] = useState<NSOData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchNSOs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("new_sales_officers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setNsoList(data || []);
    } catch (error: any) {
      console.error("Error fetching NSOs:", error);
      toast({
        title: "Error",
        description: "Failed to load New Sales Officers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNSOs();
  }, []);

  const filteredNSOs = nsoList.filter((nso) =>
    nso.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nso.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nso.mail_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditNSO = (nso: NSOData) => {
    setEditingNSO(nso);
    setEditDialogOpen(true);
  };

  const handleDeleteNSO = async () => {
    if (!deletingNSO) return;

    try {
      const { error } = await supabase
        .from("new_sales_officers")
        .delete()
        .eq("id", deletingNSO.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `New Sales Officer ${deletingNSO.first_name} ${deletingNSO.last_name} has been deleted.`,
      });

      setDeleteDialogOpen(false);
      setDeletingNSO(null);
      fetchNSOs();
    } catch (error: any) {
      console.error("Error deleting NSO:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete New Sales Officer. Please try again.",
        variant: "destructive",
      });
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight">New Sales Officers</h1>
          <p className="text-muted-foreground">
            Manage New Sales Officers (NSOs). These are not user accounts.
          </p>
        </div>
        <AddNSODialog onNSOAdded={fetchNSOs} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All New Sales Officers</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search NSOs..."
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
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Mail ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNSOs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {searchTerm ? "No NSOs found matching your search" : "No New Sales Officers found. Click 'Add NSO' to create one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNSOs.map((nso) => (
                    <TableRow key={nso.id}>
                      <TableCell className="font-medium">{nso.first_name}</TableCell>
                      <TableCell className="font-medium">{nso.last_name}</TableCell>
                      <TableCell>{nso.mail_id}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditNSO(nso)}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingNSO(nso);
                              setDeleteDialogOpen(true);
                            }}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditNSODialog
        nso={editingNSO}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onNSOUpdated={fetchNSOs}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the New Sales Officer{" "}
              <strong>
                {deletingNSO?.first_name} {deletingNSO?.last_name}
              </strong>{" "}
              ({deletingNSO?.mail_id}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNSO}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



