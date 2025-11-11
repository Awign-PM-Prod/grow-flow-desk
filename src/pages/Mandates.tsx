import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, FileText } from "lucide-react";
import { useState } from "react";

const dummyMandates = [
  { id: 1, title: "ERP Implementation", client: "Acme Corporation", value: "$150K", status: "In Progress", deadline: "2025-12-15" },
  { id: 2, title: "Cloud Migration", client: "Global Industries", value: "$200K", status: "Planning", deadline: "2025-11-30" },
  { id: 3, title: "Security Audit", client: "Tech Solutions Inc", value: "$75K", status: "In Progress", deadline: "2025-10-20" },
  { id: 4, title: "Data Analytics Platform", client: "Finance Group", value: "$300K", status: "Completed", deadline: "2025-09-15" },
  { id: 5, title: "Mobile App Development", client: "Retail Chain Co", value: "$180K", status: "In Progress", deadline: "2025-11-25" },
];

export default function Mandates() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMandates = dummyMandates.filter((mandate) =>
    mandate.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mandate.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "default";
      case "In Progress":
        return "secondary";
      case "Planning":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mandates</h1>
          <p className="text-muted-foreground">
            Track and manage client orders and project mandates.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Mandate
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Mandates</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mandates..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mandate</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMandates.map((mandate) => (
                <TableRow key={mandate.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        <FileText className="h-4 w-4 text-accent" />
                      </div>
                      <span className="font-medium">{mandate.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>{mandate.client}</TableCell>
                  <TableCell className="font-semibold">{mandate.value}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(mandate.status)}>
                      {mandate.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(mandate.deadline).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
