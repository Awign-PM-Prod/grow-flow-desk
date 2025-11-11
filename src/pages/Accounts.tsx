import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Building2 } from "lucide-react";
import { useState } from "react";

const dummyAccounts = [
  { id: 1, name: "Acme Corporation", industry: "Technology", revenue: "$2.5M", status: "Active", kam: "John Smith" },
  { id: 2, name: "Global Industries", industry: "Manufacturing", revenue: "$1.8M", status: "Active", kam: "Sarah Johnson" },
  { id: 3, name: "Tech Solutions Inc", industry: "IT Services", revenue: "$3.2M", status: "Active", kam: "Mike Chen" },
  { id: 4, name: "Finance Group", industry: "Finance", revenue: "$4.1M", status: "Prospect", kam: "Emily Davis" },
  { id: 5, name: "Retail Chain Co", industry: "Retail", revenue: "$1.5M", status: "Active", kam: "John Smith" },
];

export default function Accounts() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAccounts = dummyAccounts.filter((account) =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your customer accounts and relationships.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Accounts</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
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
                <TableHead>Account Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Annual Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Key Account Manager</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{account.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{account.industry}</TableCell>
                  <TableCell>{account.revenue}</TableCell>
                  <TableCell>
                    <Badge variant={account.status === "Active" ? "default" : "secondary"}>
                      {account.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{account.kam}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
